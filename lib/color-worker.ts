// Web Worker: Median Cut in OKLCH with saturation-weighted sampling.
// Mirrors the main-thread algorithm for consistent results.

interface RGB { r: number; g: number; b: number; }
interface OKLAB { L: number; a: number; b: number; }
interface OKLCH { L: number; C: number; h: number; }

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, v * 255)));
}

function rgbToOklab(rgb: RGB): OKLAB {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

function oklabToRgb(lab: OKLAB): RGB {
  const l = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  return {
    r: linearToSrgb(l * l * l),
    g: linearToSrgb(m * m * m),
    b: linearToSrgb(s * s * s),
  };
}

function oklabToOklch(lab: OKLAB): OKLCH {
  return { L: lab.L, C: Math.sqrt(lab.a * lab.a + lab.b * lab.b), h: Math.atan2(lab.b, lab.a) };
}

function oklchToOklab(lch: OKLCH): OKLAB {
  return { L: lch.L, a: lch.C * Math.cos(lch.h), b: lch.C * Math.sin(lch.h) };
}

// --- Median Cut ---

interface ColorPixel {
  r: number; g: number; b: number; weight: number;
}

interface ColorBox {
  pixels: ColorPixel[];
  rMin: number; rMax: number;
  gMin: number; gMax: number;
  bMin: number; bMax: number;
  volume: number;
  weightSum: number;
  chromaMin: number;
  chromaMax: number;
}

function createBox(pixels: ColorPixel[]): ColorBox {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  let weightSum = 0;
  let chromaMin = 255, chromaMax = 0;
  for (const p of pixels) {
    if (p.r < rMin) rMin = p.r;
    if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g;
    if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b;
    if (p.b > bMax) bMax = p.b;
    weightSum += p.weight;
    const c = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
    if (c < chromaMin) chromaMin = c;
    if (c > chromaMax) chromaMax = c;
  }
  const volume = (rMax - rMin + 1) * (gMax - gMin + 1) * (bMax - bMin + 1);
  return { pixels, rMin, rMax, gMin, gMax, bMin, bMax, volume, weightSum, chromaMin, chromaMax };
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] {
  const rRange = box.rMax - box.rMin;
  const gRange = box.gMax - box.gMin;
  const bRange = box.bMax - box.bMin;

  let sortFn: (a: ColorPixel, b: ColorPixel) => number;
  if (rRange >= gRange && rRange >= bRange) {
    sortFn = (a, b) => a.r - b.r;
  } else if (gRange >= rRange && gRange >= bRange) {
    sortFn = (a, b) => a.g - b.g;
  } else {
    sortFn = (a, b) => a.b - b.b;
  }

  box.pixels.sort(sortFn);

  const halfWeight = box.weightSum / 2;
  let cumWeight = 0;
  let splitIdx = Math.floor(box.pixels.length / 2);

  for (let i = 0; i < box.pixels.length; i++) {
    cumWeight += box.pixels[i].weight;
    if (cumWeight >= halfWeight) {
      splitIdx = Math.max(1, Math.min(box.pixels.length - 1, i + 1));
      break;
    }
  }

  return [
    createBox(box.pixels.slice(0, splitIdx)),
    createBox(box.pixels.slice(splitIdx)),
  ];
}

function representativeColor(box: ColorBox): RGB {
  // Weighted average
  let ar = 0, ag = 0, ab = 0, totalW = 0;
  for (const p of box.pixels) {
    ar += p.r * p.weight;
    ag += p.g * p.weight;
    ab += p.b * p.weight;
    totalW += p.weight;
  }
  if (totalW === 0) totalW = 1;
  const avgR = ar / totalW;
  const avgG = ag / totalW;
  const avgB = ab / totalW;

  // Find the pixel with highest chroma in the box
  let bestChroma = -1;
  let bestP = box.pixels[0];
  for (const p of box.pixels) {
    const cMax = Math.max(p.r, p.g, p.b);
    const cMin = Math.min(p.r, p.g, p.b);
    const chroma = cMax - cMin;
    if (chroma > bestChroma) {
      bestChroma = chroma;
      bestP = p;
    }
  }

  // Blend: 70% most-saturated pixel, 30% weighted average
  // For low-chroma boxes (grays), use mostly average
  const chromaRatio = Math.min(1, bestChroma / 80);
  const vividMix = 0.75 * chromaRatio;
  const avgMix = 1 - vividMix;

  return {
    r: Math.round(avgR * avgMix + bestP.r * vividMix),
    g: Math.round(avgG * avgMix + bestP.g * vividMix),
    b: Math.round(avgB * avgMix + bestP.b * vividMix),
  };
}

function medianCut(pixels: ColorPixel[], k: number): RGB[] {
  if (pixels.length === 0) return Array(k).fill({ r: 128, g: 128, b: 128 });

  const boxes: ColorBox[] = [createBox(pixels)];

  while (boxes.length < k) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pixels.length < 2) continue;
      const chromaSpread = (boxes[i].chromaMax - boxes[i].chromaMin) / 255;
      const score = boxes[i].volume * Math.log(boxes[i].weightSum + 1) * (1 + chromaSpread * 2);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (boxes[bestIdx].pixels.length < 2) break;

    const [a, b] = splitBox(boxes[bestIdx]);
    boxes.splice(bestIdx, 1, a, b);
  }

  return boxes.map(representativeColor);
}

// --- Chroma boost ---

function boostChroma(color: RGB, factor: number): RGB {
  const lab = rgbToOklab(color);
  const lch = oklabToOklch(lab);
  if (lch.C < 0.015) return color;

  const lightnessMultiplier = 1 - Math.abs(lch.L - 0.55) * 0.6;
  const boost = 1 + factor * Math.max(0.1, lightnessMultiplier);
  lch.C = Math.min(lch.C * boost, 0.45);

  const boosted = oklabToRgb(oklchToOklab(lch));
  return {
    r: Math.max(0, Math.min(255, boosted.r)),
    g: Math.max(0, Math.min(255, boosted.g)),
    b: Math.max(0, Math.min(255, boosted.b)),
  };
}

// --- Worker message handler ---

self.onmessage = (e: MessageEvent) => {
  const { imageData, width, height, k, sampleSize } = e.data;
  const data = new Uint8ClampedArray(imageData);
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / sampleSize));

  const pixels: ColorPixel[] = [];

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 3 || lum > 252) continue;

    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const chroma = cMax - cMin;
    const chromaNorm = chroma / 255;
    const weight = 1.0 + chromaNorm * chromaNorm * 10.0;

    pixels.push({ r, g, b, weight });
  }

  // Fallback without filter
  if (pixels.length < sampleSize * 0.2) {
    pixels.length = 0;
    for (let i = 0; i < data.length; i += step * 4) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], weight: 1.0 });
    }
  }

  const rawColors = medianCut(pixels, k);
  const boosted = rawColors.map((c) => boostChroma(c, 0.4));

  // Sort by perceptual luminance
  boosted.sort((a, b) => {
    const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
    const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
    return lumA - lumB;
  });

  self.postMessage({ colors: boosted });
};
