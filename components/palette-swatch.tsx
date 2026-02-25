"use client";

import { type RGB, rgbToHex, getContrastColor } from "@/lib/color-extractor";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface PaletteSwatchProps {
  color: RGB;
  index: number;
  compact?: boolean;
}

export function PaletteSwatch({ color, index, compact = false }: PaletteSwatchProps) {
  const [copied, setCopied] = useState(false);
  const hex = rgbToHex(color);
  const contrast = getContrastColor(color);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hex);
    setCopied(true);
    toast.success(`Copied ${hex}`, { duration: 1500 });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`group relative flex-1 flex items-center justify-center cursor-pointer overflow-hidden motion-reduce:!duration-1000 ${
        compact ? "h-full" : "aspect-square flex-col"
      }`}
      style={{
        backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
        transition: "background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "background-color",
      }}
      aria-label={`Color ${index + 1}: ${hex}. Click to copy.`}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(to top, ${contrast === "#000000" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.1)"}, transparent)`,
        }}
      />
      {!compact && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+14px)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ color: contrast }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-3.5 h-3.5" />}
        </div>
      )}
      <div className={`relative flex items-center ${compact ? "gap-1.5" : ""}`}>
        <span
          className={`font-mono tracking-wide uppercase transition-opacity duration-300 ${
            compact ? "text-[10px]" : "text-xs opacity-70"
          }`}
          style={{ color: contrast }}
        >
          {hex}
        </span>
        {compact && copied && (
          <Check className="w-3 h-3 ml-1.5" style={{ color: contrast }} />
        )}
      </div>
    </button>
  );
}
