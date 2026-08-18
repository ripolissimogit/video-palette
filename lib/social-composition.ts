import type { CropBounds } from "./color-extractor";

export type SocialPresetId = "original" | "reel" | "instagram" | "square" | "landscape";

export interface SocialPreset {
  id: SocialPresetId;
  label: string;
  width: number | null;
  height: number | null;
  paletteFraction: number;
  videoAspectRatio: number | null;
}

const PALETTE_FRACTION = 0.15;

function preset(
  id: Exclude<SocialPresetId, "original">,
  label: string,
  width: number,
  height: number
): SocialPreset {
  return {
    id,
    label,
    width,
    height,
    paletteFraction: PALETTE_FRACTION,
    videoAspectRatio: width / (height * (1 - PALETTE_FRACTION)),
  };
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: "original", label: "Originale", width: null, height: null, paletteFraction: 0, videoAspectRatio: null },
  preset("reel", "Reel 9:16", 1080, 1920),
  preset("instagram", "Post 4:5", 1080, 1350),
  preset("square", "Quadrato 1:1", 1080, 1080),
  preset("landscape", "Orizzontale 16:9", 1920, 1080),
];

export function getPreset(id: SocialPresetId): SocialPreset {
  return SOCIAL_PRESETS.find((preset) => preset.id === id) ?? SOCIAL_PRESETS[0];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function getCoverCrop(rawWidth: number, rawHeight: number, preset: SocialPreset): CropBounds {
  if (!preset.videoAspectRatio || rawWidth <= 0 || rawHeight <= 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const sourceAspect = rawWidth / rawHeight;
  if (sourceAspect > preset.videoAspectRatio) {
    const visibleWidth = preset.videoAspectRatio / sourceAspect;
    const side = (1 - visibleWidth) / 2;
    return { top: 0, bottom: 0, left: side, right: side };
  }

  const visibleHeight = sourceAspect / preset.videoAspectRatio;
  const side = (1 - visibleHeight) / 2;
  return { top: side, bottom: side, left: 0, right: 0 };
}

export function moveCrop(crop: CropBounds, deltaX: number, deltaY: number): CropBounds {
  const width = 1 - crop.left - crop.right;
  const height = 1 - crop.top - crop.bottom;
  const left = clamp(crop.left + deltaX, 0, 1 - width);
  const top = clamp(crop.top + deltaY, 0, 1 - height);
  return { left: round(left), right: round(1 - left - width), top: round(top), bottom: round(1 - top - height) };
}

export function scaleCrop(
  crop: CropBounds,
  rawWidth: number,
  rawHeight: number,
  preset: SocialPreset,
  scale: number
): CropBounds {
  if (!preset.videoAspectRatio || rawWidth <= 0 || rawHeight <= 0) return crop;

  const oldWidth = 1 - crop.left - crop.right;
  const oldHeight = 1 - crop.top - crop.bottom;
  const minWidth = Math.max(0.05, (rawHeight * 0.05 * preset.videoAspectRatio) / rawWidth);
  const width = clamp(oldWidth * scale, minWidth, 1);
  const height = (rawWidth * width) / (rawHeight * preset.videoAspectRatio);
  const boundedHeight = Math.min(1, height);
  const boundedWidth = (rawHeight * boundedHeight * preset.videoAspectRatio) / rawWidth;
  const centerX = crop.left + oldWidth / 2;
  const centerY = crop.top + oldHeight / 2;
  const left = clamp(centerX - boundedWidth / 2, 0, 1 - boundedWidth);
  const top = clamp(centerY - boundedHeight / 2, 0, 1 - boundedHeight);
  return { left, right: 1 - left - boundedWidth, top, bottom: 1 - top - boundedHeight };
}
