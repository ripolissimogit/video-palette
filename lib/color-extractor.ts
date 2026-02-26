// Color extraction using node-vibrant for accent-aware palette generation.
// Vibrant uses MMCQ quantization + intelligent swatch selection that preserves
// both dominant and accent colors — solving the accent-loss problem of plain Median Cut.

import { Vibrant } from "node-vibrant/browser";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// --- Letterbox detection ---

export interface CropBounds {
  top: number;    // fraction 0-1
  bottom: number; // fraction 0-1
  left: number;   // fraction 0-1
  right: number;  // fraction 0-1
}

const LETTERBOX_THRESHOLD = 18; // max average brightness to consider "black"
const MIN_CROP_FRACTION = 0.03; // ignore bars smaller than 3% of dimension

let cachedCrop: CropBounds | null = null;
let cropVideoSrc = "";

export function clearCropCache() {
  cachedCrop = null;
  cropVideoSrc = "";
}

export function detectLetterbox(
  video: HTMLVideoElement,
): CropBounds {
  // Return cached result for the same video
  if (cachedCrop && cropVideoSrc === video.src) return cachedCrop;

  const w = 120;
  const h = Math.round((video.videoHeight / video.videoWidth) * w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth) return { top: 0, bottom: 0, left: 0, right: 0 };

  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // A true letterbox bar is uniformly dark (near-zero variance).
  // Dark video content has variation. We check both brightness AND uniformity.
  const MAX_STDDEV = 6;

  function isBarRow(y: number): boolean {
    let sum = 0;
    let sumSq = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += b;
      sumSq += b * b;
    }
    const mean = sum / w;
    if (mean > LETTERBOX_THRESHOLD) return false;
    const variance = sumSq / w - mean * mean;
    return Math.sqrt(Math.max(0, variance)) <= MAX_STDDEV;
  }

  function isBarCol(x: number): boolean {
    let sum = 0;
    let sumSq = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += b;
      sumSq += b * b;
    }
    const mean = sum / h;
    if (mean > LETTERBOX_THRESHOLD) return false;
    const variance = sumSq / h - mean * mean;
    return Math.sqrt(Math.max(0, variance)) <= MAX_STDDEV;
  }

  // Scan top
  let top = 0;
  for (let y = 0; y < h; y++) {
    if (!isBarRow(y)) break;
    top = y + 1;
  }

  // Scan bottom
  let bottom = 0;
  for (let y = h - 1; y >= 0; y--) {
    if (!isBarRow(y)) break;
    bottom = h - y;
  }

  // Scan left
  let left = 0;
  for (let x = 0; x < w; x++) {
    if (!isBarCol(x)) break;
    left = x + 1;
  }

  // Scan right
  let right = 0;
  for (let x = w - 1; x >= 0; x--) {
    if (!isBarCol(x)) break;
    right = w - x;
  }

  const rawTop = top / h;
  const rawBottom = bottom / h;
  const rawLeft = left / w;
  const rawRight = right / w;

  // Safety: if total crop exceeds 50% in either dimension, it's a false detection
  // (e.g. black first frame before video decodes)
  if (rawTop + rawBottom > 0.5 || rawLeft + rawRight > 0.5) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const crop: CropBounds = {
    top: rawTop > MIN_CROP_FRACTION ? rawTop : 0,
    bottom: rawBottom > MIN_CROP_FRACTION ? rawBottom : 0,
    left: rawLeft > MIN_CROP_FRACTION ? rawLeft : 0,
    right: rawRight > MIN_CROP_FRACTION ? rawRight : 0,
  };

  cachedCrop = crop;
  cropVideoSrc = video.src;
  return crop;
}

export function hasCrop(crop: CropBounds): boolean {
  return crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;
}

// --- Canvas rendering ---

const TARGET_WIDTH = 220;

function drawVideoToCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  explicitCrop?: CropBounds,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth) return null;

  const crop = explicitCrop ?? detectLetterbox(video);

  // Source region (cropped area of the video)
  const sx = Math.round(crop.left * video.videoWidth);
  const sy = Math.round(crop.top * video.videoHeight);
  const sw = video.videoWidth - sx - Math.round(crop.right * video.videoWidth);
  const sh = video.videoHeight - sy - Math.round(crop.bottom * video.videoHeight);

  const scale = Math.min(1, TARGET_WIDTH / sw);
  canvas.width  = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return ctx;
}

// --- Swatch priority: accent colors first, then muted tones ---

// --- Public API ---

export async function extractColorsFromCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  k: number = 5,
  _sampleSize?: number,
  explicitCrop?: CropBounds,
): Promise<RGB[]> {
  const ctx = drawVideoToCanvas(canvas, video, explicitCrop);
  if (!ctx) return [];

  try {
    const dataUrl = canvas.toDataURL();
    const v = Vibrant.from(dataUrl)
      .maxColorCount(64)
      .quality(1)
      .build();

    const palette = await v.getPalette();
    const allQuantized = v.result?.colors ?? [];

    // Build candidate pool: all quantized colors sorted by population,
    // excluding near-black/near-white (letterboxing, overexposed areas)
    const candidates = [...allQuantized]
      .sort((a, b) => b.population - a.population)
      .map((s) => ({
        r: Math.round(s.rgb[0]),
        g: Math.round(s.rgb[1]),
        b: Math.round(s.rgb[2]),
        pop: s.population,
      }))
      .filter((c) => {
        const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        return lum > 10 && lum < 245;
      });

    // Also collect named Vibrant swatch (the accent) to guarantee inclusion
    const vibrantSwatch = palette.Vibrant;
    let accent: RGB | null = null;
    let accentPop = 0;
    if (vibrantSwatch) {
      accent = {
        r: Math.round(vibrantSwatch.rgb[0]),
        g: Math.round(vibrantSwatch.rgb[1]),
        b: Math.round(vibrantSwatch.rgb[2]),
      };
      accentPop = vibrantSwatch.population;
    }

    const totalPop = allQuantized.reduce((sum: number, s: { population: number }) => sum + s.population, 0);

    // Greedy selection: pick colors by population, enforcing minimum perceptual distance
    const MIN_DIST_SQ = 2500; // ~50 RGB units apart
    const colors: RGB[] = [];

    // Always start with the most populous color (the dominant tone)
    if (candidates.length > 0) {
      const top = candidates[0];
      colors.push({ r: top.r, g: top.g, b: top.b });
    }

    // Guarantee the Vibrant accent a slot only when it:
    //   1. Is perceptually far from the dominant color (>50 RGB units)
    //   2. Has meaningful saturation (>8%) — guards against B&W artifact colors
    //   3. Represents at least 2% of frame pixels — guards against micro-details
    //      (e.g. solar panel glint, tiny logo) being promoted over dominant tones
    const MIN_ACCENT_SAT = 0.08;
    const MIN_ACCENT_POP_FRAC = 0.02;
    if (accent && colors.length > 0) {
      const dist = rgbDistanceSq(accent, colors[0]);
      const popFrac = totalPop > 0 ? accentPop / totalPop : 0;
      if (dist >= MIN_DIST_SQ && rgbSaturation(accent) >= MIN_ACCENT_SAT && popFrac >= MIN_ACCENT_POP_FRAC) {
        colors.push(accent);
      }
    }

    // Fill remaining slots from candidates, ensuring diversity
    for (const c of candidates) {
      if (colors.length >= k) break;
      const rgb = { r: c.r, g: c.g, b: c.b };
      const tooClose = colors.some((existing) => rgbDistanceSq(existing, rgb) < MIN_DIST_SQ);
      if (!tooClose) {
        colors.push(rgb);
      }
    }

    // If still short (very uniform frames), relax distance constraint
    if (colors.length < k) {
      for (const c of candidates) {
        if (colors.length >= k) break;
        const rgb = { r: c.r, g: c.g, b: c.b };
        const duplicate = colors.some((existing) => rgbDistanceSq(existing, rgb) < 100);
        if (!duplicate) {
          colors.push(rgb);
        }
      }
    }

    // Final fallback
    while (colors.length < k) {
      colors.push({ r: 128, g: 128, b: 128 });
    }

    // Sort by perceptual luminance (dark to light)
    colors.sort((a, b) => {
      const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
      const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
      return lumA - lumB;
    });

    return colors;
  } catch {
    return Array(k).fill({ r: 128, g: 128, b: 128 });
  }
}

export function extractColorsAsync(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  k: number = 5,
  sampleSize?: number,
  explicitCrop?: CropBounds,
): Promise<RGB[]> {
  return extractColorsFromCanvas(canvas, video, k, sampleSize, explicitCrop);
}

// --- Utilities ---

export function rgbToHex(color: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function rgbToString(color: RGB): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function getContrastColor(color: RGB): string {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return luminance > 128 ? "#000000" : "#ffffff";
}

// --- Stable color matching ---
// Re-orders newColors to best match prevColors' slot positions,
// eliminating the primary cause of palette flashing.

function rgbDistanceSq(a: RGB, b: RGB): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

// HSL saturation (0–1). Returns 0 for pure grays.
function rgbSaturation(c: RGB): number {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

export function matchColorOrder(prevColors: RGB[], newColors: RGB[]): RGB[] {
  if (prevColors.length === 0 || prevColors.length !== newColors.length) {
    return newColors;
  }
  const k = newColors.length;
  const used = new Uint8Array(k);
  const result: RGB[] = new Array(k);

  for (let i = 0; i < k; i++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < k; j++) {
      if (used[j]) continue;
      const d = rgbDistanceSq(prevColors[i], newColors[j]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      result[i] = newColors[bestIdx];
      used[bestIdx] = 1;
    } else {
      result[i] = newColors[i];
    }
  }
  return result;
}

// --- Smooth interpolation ---
const MAX_CHANNEL_DELTA = 35;
// Changes below this RGB distance are considered compression noise and suppressed.
// sqrt(625) = 25 units — covers frame-to-frame MMCQ bucket instability on static scenes.
const DEADBAND_SQ = 625;

function clampDelta(from: number, to: number, t: number): number {
  const raw = Math.round(from + (to - from) * t);
  const delta = raw - from;
  if (Math.abs(delta) > MAX_CHANNEL_DELTA) {
    return from + Math.sign(delta) * MAX_CHANNEL_DELTA;
  }
  return raw;
}

export function lerpColors(from: RGB[], to: RGB[], t: number): RGB[] {
  return to.map((toColor, i) => {
    const fromColor = from[i] || toColor;
    // Suppress updates within the noise floor — prevents H.264 quantization
    // artifacts from causing visible flicker on visually static frames.
    if (rgbDistanceSq(fromColor, toColor) <= DEADBAND_SQ) return fromColor;
    return {
      r: clampDelta(fromColor.r, toColor.r, t),
      g: clampDelta(fromColor.g, toColor.g, t),
      b: clampDelta(fromColor.b, toColor.b, t),
    };
  });
}
