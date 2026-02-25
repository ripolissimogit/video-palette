"use client";

import { type RGB } from "@/lib/color-extractor";
import { PaletteSwatch } from "./palette-swatch";

interface PaletteBarProps {
  colors: RGB[];
  compact?: boolean;
}

export function PaletteBar({ colors, compact = false }: PaletteBarProps) {
  return (
    <div className={`flex overflow-hidden ${compact ? "h-12" : ""}`}>
      {colors.map((color, i) => (
        <PaletteSwatch key={i} color={color} index={i} compact={compact} />
      ))}
    </div>
  );
}
