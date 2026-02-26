// Color extraction using k-means clustering in CIE LAB color space.
// LAB k-means finds cluster centroids that correspond to colors actually present
// in the frame — more accurate than MMCQ which returns box-midpoint approximations.

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

// --- Extraction settings ---

export interface ExtractionSettings {
  /** Deadband in RGB units (0–80). Changes smaller than this are suppressed at the extraction gate. */
  deadband: number;
  /** Blend factor (0.05–1.0). How fast colors update per frame. */
  blendFactor: number;
  /** Minimum fraction of frame pixels a cluster must cover to enter the selection pool (0–0.10). */
  minClusterSize: number;
  /** Minimum LAB ΔE distance between selected colors (10–60). */
  minColorDist: number;
  /** Saturation weight (0–3). Boosts sampling probability for highly-saturated pixels. */
  saturationWeight: number;
  /** Local contrast weight (0–3). Boosts sampling probability for pixels at high-contrast edges. */
  contrastWeight: number;
}

export const DEFAULT_EXTRACTION_SETTINGS: ExtractionSettings = {
  deadband: 55,
  blendFactor: 0.10,
  minClusterSize: 0.02,
  minColorDist: 25,
  saturationWeight: 0.5,
  contrastWeight: 0.3,
};

// --- k-means clustering in CIE LAB color space ---

const MAX_SAMPLES = 3000;
const KMEANS_ITERS = 14;

function linearize(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b);
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  const f = (t: number) => t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116;
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x / 0.95047) - fy), 200 * (fy - f(z / 1.08883))];
}

function labToRgb(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116;
  const cube = (t: number) => { const v = t ** 3; return v > 0.008856 ? v : (t - 16 / 116) / 7.787; };
  const x = cube(a / 500 + fy) * 0.95047;
  const y = cube(fy);
  const z = cube(fy - b / 200) * 1.08883;
  const lr =  x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
  const lg = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
  const lb =  x * 0.0556434 - y * 0.2040259 + z * 1.0572252;
  const toSrgb = (c: number) => Math.round(Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)) * 255);
  return { r: toSrgb(lr), g: toSrgb(lg), b: toSrgb(lb) };
}

function labDistSq(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

interface KCluster { centroid: [number, number, number]; pop: number; rgb: RGB; }

function kmeansLab(labs: Array<[number, number, number]>, k: number): KCluster[] {
  const n = labs.length;
  k = Math.min(k, n);
  if (k === 0) return [];

  // k-means++ initialization
  const seedIdx: number[] = [Math.floor(Math.random() * n)];
  while (seedIdx.length < k) {
    const dists = labs.map((p) => {
      let min = Infinity;
      for (const si of seedIdx) min = Math.min(min, labDistSq(p, labs[si]));
      return min;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    seedIdx.push(chosen);
  }

  let centroids = seedIdx.map((i) => [...labs[i]] as [number, number, number]);
  const assign = new Int32Array(n);

  for (let iter = 0; iter < KMEANS_ITERS; iter++) {
    // Assign each point to nearest centroid
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = labDistSq(labs[i], centroids[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      assign[i] = best;
    }
    // Update centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0] as [number, number, number, number]);
    for (let i = 0; i < n; i++) {
      const s = sums[assign[i]];
      s[0] += labs[i][0]; s[1] += labs[i][1]; s[2] += labs[i][2]; s[3]++;
    }
    centroids = sums.map((s, j) =>
      s[3] > 0 ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centroids[j]
    );
  }

  const pops = new Int32Array(k);
  for (let i = 0; i < n; i++) pops[assign[i]]++;

  return centroids
    .map((c, j) => ({ centroid: c, pop: pops[j], rgb: labToRgb(c[0], c[1], c[2]) }))
    .sort((a, b) => b.pop - a.pop);
}

// --- Public API ---

export async function extractColorsFromCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  k: number = 5,
  _sampleSize?: number,
  explicitCrop?: CropBounds,
  settings?: ExtractionSettings,
): Promise<RGB[]> {
  const ctx = drawVideoToCanvas(canvas, video, explicitCrop);
  if (!ctx) return [];

  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    const totalPx = W * H;
    const satW = settings?.saturationWeight ?? DEFAULT_EXTRACTION_SETTINGS.saturationWeight;
    const contW = settings?.contrastWeight  ?? DEFAULT_EXTRACTION_SETTINGS.contrastWeight;

    // Pass 1: luminance map for local-contrast computation
    const lumMap = new Float32Array(totalPx);
    for (let i = 0; i < totalPx; i++) {
      const o = i * 4;
      lumMap[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
    }

    // Pass 2: collect valid pixels with perceptual weights
    // weight = 1 + satW * saturation + contW * localContrast * 4
    const validR: Uint8Array   = new Uint8Array(totalPx);
    const validG: Uint8Array   = new Uint8Array(totalPx);
    const validB: Uint8Array   = new Uint8Array(totalPx);
    const validW: Float32Array = new Float32Array(totalPx);
    // Coarse RGB histogram used to anchor the palette to truly dominant area colors.
    const HIST_SIZE = 32 * 32 * 32;
    const histCount = new Uint32Array(HIST_SIZE);
    const histR = new Uint32Array(HIST_SIZE);
    const histG = new Uint32Array(HIST_SIZE);
    const histB = new Uint32Array(HIST_SIZE);
    let nValid = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const o = i * 4;
        const r = data[o], g = data[o + 1], b = data[o + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum <= 10 || lum >= 245) continue;
        if (lum < 30 && rgbSaturation({ r, g, b }) < 0.12) continue;

        const lumN = lumMap[i];
        const rl = r / 255, gl = g / 255, bl = b / 255;
        const max = Math.max(rl, gl, bl), min = Math.min(rl, gl, bl);
        const denom = 1 - Math.abs(2 * lumN - 1);
        const sat = denom < 0.001 ? 0 : (max - min) / denom;

        let neighborSum = 0, nNeighbors = 0;
        if (x > 0)     { neighborSum += lumMap[i - 1]; nNeighbors++; }
        if (x < W - 1) { neighborSum += lumMap[i + 1]; nNeighbors++; }
        if (y > 0)     { neighborSum += lumMap[i - W]; nNeighbors++; }
        if (y < H - 1) { neighborSum += lumMap[i + W]; nNeighbors++; }
        const localContrast = nNeighbors > 0 ? Math.abs(lumN - neighborSum / nNeighbors) : 0;

        const w = 1.0 + satW * sat + contW * localContrast * 4;
        validR[nValid] = r; validG[nValid] = g; validB[nValid] = b;
        validW[nValid] = w;
        const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        histCount[bin] += 1;
        histR[bin] += r;
        histG[bin] += g;
        histB[bin] += b;
        nValid++;
      }
    }

    if (nValid === 0) return Array(k).fill({ r: 128, g: 128, b: 128 });

    // Pass 3: sample pixels — weighted CDF or uniform step
    const nSamples = Math.min(MAX_SAMPLES, nValid);
    const labs: Array<[number, number, number]> = [];

    if (satW === 0 && contW === 0) {
      // Fast path: uniform step
      const step = Math.max(1, Math.floor(nValid / nSamples));
      for (let i = 0; i < nValid && labs.length < nSamples; i += step) {
        labs.push(rgbToLab(validR[i], validG[i], validB[i]));
      }
    } else {
      // Weighted sampling via CDF — saturated / high-contrast pixels are sampled more often
      const cdf = new Float32Array(nValid);
      let cumSum = 0;
      for (let i = 0; i < nValid; i++) { cumSum += validW[i]; cdf[i] = cumSum; }
      // Mix weighted + uniform sampling so large flat regions are still represented.
      const weightedSamples = Math.max(1, Math.round(nSamples * 0.65));
      for (let s = 0; s < weightedSamples; s++) {
        const target = Math.random() * cumSum;
        let lo = 0, hi = nValid - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid + 1; else hi = mid; }
        labs.push(rgbToLab(validR[lo], validG[lo], validB[lo]));
      }
      const remaining = nSamples - weightedSamples;
      if (remaining > 0) {
        const step = Math.max(1, Math.floor(nValid / remaining));
        for (let i = 0; i < nValid && labs.length < nSamples; i += step) {
          labs.push(rgbToLab(validR[i], validG[i], validB[i]));
        }
      }
    }

    if (labs.length === 0) return Array(k).fill({ r: 128, g: 128, b: 128 });

    // Run k-means with extra clusters so greedy selection has more to choose from
    const clusters = kmeansLab(labs, Math.min(k + 4, labs.length));
    const totalPop = clusters.reduce((s, c) => s + c.pop, 0);

    // Prominent pool: clusters covering ≥ accentMinPop of sampled pixels
    const minPopFrac = settings?.minClusterSize ?? DEFAULT_EXTRACTION_SETTINGS.minClusterSize;
    type Candidate = {
      r: number;
      g: number;
      b: number;
      pop: number;
      lab: [number, number, number];
    };

    const allCandidates: Candidate[] = clusters.map((c) => ({
      ...c.rgb,
      pop: c.pop,
      lab: c.centroid,
    }));
    const candidates = totalPop > 0
      ? allCandidates.filter((c) => c.pop / totalPop >= minPopFrac)
      : allCandidates;

    // Dominant area anchor from histogram (area-based, not contrast/saturation-weighted).
    let dominantCandidate: { r: number; g: number; b: number; pop: number; lab: [number, number, number] } | null = null;
    let dominantBin = -1;
    let dominantCount = 0;
    for (let i = 0; i < histCount.length; i++) {
      if (histCount[i] > dominantCount) {
        dominantCount = histCount[i];
        dominantBin = i;
      }
    }
    if (dominantBin >= 0 && dominantCount > 0) {
      const r = Math.round(histR[dominantBin] / dominantCount);
      const g = Math.round(histG[dominantBin] / dominantCount);
      const b = Math.round(histB[dominantBin] / dominantCount);
      dominantCandidate = { r, g, b, pop: dominantCount, lab: rgbToLab(r, g, b) };
    }

    // Greedy selection using LAB distance (same space as clustering).
    // Adaptive scaling: larger k → lower threshold so the palette stays fillable.
    const minDistBase = settings?.minColorDist ?? DEFAULT_EXTRACTION_SETTINGS.minColorDist;
    const minDistAdaptive = Math.max(10, Math.round(minDistBase * Math.sqrt(5 / k)));
    const MIN_LAB_SQ = minDistAdaptive * minDistAdaptive;
    const colors: RGB[] = [];
    const selectedLabs: Array<[number, number, number]> = [];
    const totalPopSafe = Math.max(1, totalPop);
    const EXTREME_DARK_LUMA = 24;
    const EXTREME_LIGHT_LUMA = 245;
    const minExtremePopFrac = Math.max(minPopFrac * 1.5, 0.05);
    let selectedExtremeDark = 0;
    let selectedExtremeLight = 0;

    const lumaOf = (c: { r: number; g: number; b: number }) =>
      0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

    const trackExtreme = (c: { r: number; g: number; b: number }) => {
      const luma = lumaOf(c);
      if (luma <= EXTREME_DARK_LUMA) selectedExtremeDark += 1;
      if (luma >= EXTREME_LIGHT_LUMA) selectedExtremeLight += 1;
    };

    const canSelectCandidate = (c: Candidate): boolean => {
      const luma = lumaOf(c);
      const popFrac = c.pop / totalPopSafe;
      const isExtremeDark = luma <= EXTREME_DARK_LUMA;
      const isExtremeLight = luma >= EXTREME_LIGHT_LUMA;

      // Keep extreme tones only when they are truly present as a significant area.
      if ((isExtremeDark || isExtremeLight) && popFrac < minExtremePopFrac) {
        return false;
      }

      // Avoid multiple near-black/near-white swatches unless they are very dominant.
      if (isExtremeDark && selectedExtremeDark >= 1 && popFrac < minExtremePopFrac * 1.6) {
        return false;
      }
      if (isExtremeLight && selectedExtremeLight >= 1 && popFrac < minExtremePopFrac * 1.6) {
        return false;
      }

      return true;
    };

    if (dominantCandidate) {
      colors.push({ r: dominantCandidate.r, g: dominantCandidate.g, b: dominantCandidate.b });
      selectedLabs.push(dominantCandidate.lab);
      trackExtreme(dominantCandidate);
    }

    // Pass 1: prominent clusters, full adaptive LAB distance
    for (const c of candidates) {
      if (colors.length >= k) break;
      if (!canSelectCandidate(c)) continue;
      if (!selectedLabs.some((l) => labDistSq(l, c.lab) < MIN_LAB_SQ)) {
        colors.push({ r: c.r, g: c.g, b: c.b });
        selectedLabs.push(c.lab);
        trackExtreme(c);
      }
    }

    // Pass 2: relax to quarter distance
    if (colors.length < k) {
      const RELAXED_SQ = Math.max(50, Math.round(MIN_LAB_SQ / 4));
      for (const c of allCandidates) {
        if (colors.length >= k) break;
        if (!canSelectCandidate(c)) continue;
        if (!selectedLabs.some((l) => labDistSq(l, c.lab) < RELAXED_SQ)) {
          colors.push({ r: c.r, g: c.g, b: c.b });
          selectedLabs.push(c.lab);
          trackExtreme(c);
        }
      }
    }

    // Pass 3: allow near-duplicates (blocks only perceptually identical, ΔE < 3)
    if (colors.length < k) {
      for (const c of allCandidates) {
        if (colors.length >= k) break;
        if (!canSelectCandidate(c)) continue;
        if (!selectedLabs.some((l) => labDistSq(l, c.lab) < 9)) {
          colors.push({ r: c.r, g: c.g, b: c.b });
          selectedLabs.push(c.lab);
          trackExtreme(c);
        }
      }
    }

    while (colors.length < k) colors.push({ r: 128, g: 128, b: 128 });

    // Sort dark to light
    colors.sort((a, b) =>
      (0.299 * a.r + 0.587 * a.g + 0.114 * a.b) - (0.299 * b.r + 0.587 * b.g + 0.114 * b.b)
    );

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
  settings?: ExtractionSettings,
): Promise<RGB[]> {
  return extractColorsFromCanvas(canvas, video, k, sampleSize, explicitCrop, settings);
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
// sqrt(3025) = 55 units — covers MMCQ bucket instability + H.264 noise on static scenes.
const DEADBAND_SQ = 3025;

function clampDelta(from: number, to: number, t: number): number {
  const raw = Math.round(from + (to - from) * t);
  const delta = raw - from;
  if (Math.abs(delta) > MAX_CHANNEL_DELTA) {
    return from + Math.sign(delta) * MAX_CHANNEL_DELTA;
  }
  return raw;
}

export function lerpColors(from: RGB[], to: RGB[], t: number, deadband?: number): RGB[] {
  const deadbandSq = deadband !== undefined ? deadband * deadband : DEADBAND_SQ;
  return to.map((toColor, i) => {
    const fromColor = from[i] || toColor;
    // Suppress updates within the noise floor — prevents H.264 quantization
    // artifacts from causing visible flicker on visually static frames.
    if (rgbDistanceSq(fromColor, toColor) <= deadbandSq) return fromColor;
    return {
      r: clampDelta(fromColor.r, toColor.r, t),
      g: clampDelta(fromColor.g, toColor.g, t),
      b: clampDelta(fromColor.b, toColor.b, t),
    };
  });
}
