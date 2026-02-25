"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { type RGB, lerpColors, matchColorOrder } from "@/lib/color-extractor";
import { VideoDropzone } from "./video-dropzone";
import { VideoPlayer } from "./video-player";
import { PaletteBar } from "./palette-bar";
import { ColorCountSelector } from "./color-count-selector";
import { ExportPanel } from "./export-panel";
import { ThemeToggle } from "./theme-toggle";
import { Film } from "lucide-react";

const DEFAULT_COLORS: RGB[] = [
  { r: 30, g: 30, b: 40 },
  { r: 60, g: 55, b: 70 },
  { r: 100, g: 95, b: 110 },
  { r: 150, g: 145, b: 160 },
  { r: 200, g: 195, b: 210 },
];

export function VideoPaletteApp() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [colors, setColors] = useState<RGB[]>(DEFAULT_COLORS);
  const [colorCount, setColorCount] = useState(5);
  const latestColorsRef = useRef<RGB[]>(DEFAULT_COLORS);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fullscreen container ref - wraps video + palette
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleVideoSelect = useCallback((url: string, name: string) => {
    setVideoSrc(url);
    setVideoName(name);
  }, []);

  const handleColorsExtracted = useCallback(
    (newColors: RGB[]) => {
      // 1. Stable ordering: re-order new colors to match previous frame's slots
      const matched = matchColorOrder(latestColorsRef.current, newColors);
      // 2. Smooth interpolation -- Median Cut is much more stable than K-means
      //    so we can use a higher blend factor for more responsive colors
      const blendFactor = reducedMotion ? 0.25 : 0.5;
      const smoothed = lerpColors(latestColorsRef.current, matched, blendFactor);
      setColors(smoothed);
      latestColorsRef.current = smoothed;
    },
    [reducedMotion]
  );

  const handleRemove = useCallback(() => {
    if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setVideoName("");
    setColors(DEFAULT_COLORS);
    latestColorsRef.current = DEFAULT_COLORS;
  }, [videoSrc]);

  const handleColorCountChange = useCallback((count: number) => {
    setColorCount(count);
  }, []);

  return (
    <div
      className={`min-h-screen bg-background flex flex-col transition-opacity duration-500 ${
        isLoaded ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Header */}
      <header className="border-b border-border" role="banner">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <Film className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Video Palette
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Real-time color extraction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {videoSrc && (
              <>
                <div className="hidden sm:block">
                  <ColorCountSelector
                    count={colorCount}
                    onChange={handleColorCountChange}
                  />
                </div>
                <ExportPanel
                  videoSrc={videoSrc}
                  colorCount={colorCount}
                  colors={colors}
                />
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {/* Mobile color count selector */}
        {videoSrc && (
          <div className="sm:hidden border-t border-border px-4 py-3">
            <ColorCountSelector
              count={colorCount}
              onChange={handleColorCountChange}
            />
          </div>
        )}
      </header>

      {/* Main content */}
      <main
        className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8"
        role="main"
      >
        {!videoSrc ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="w-full max-w-xl">
              <VideoDropzone onVideoSelect={handleVideoSelect} />
            </div>
            {/* Preview palette */}
            <div className="w-full max-w-xl">
              <PaletteBar colors={DEFAULT_COLORS} />
              <p
                className="text-center text-xs text-muted-foreground mt-4"
                aria-live="polite"
              >
                Colors will update in real-time as your video plays
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Fullscreen container: video + palette */}
            <div
              ref={fullscreenContainerRef}
              className={`flex flex-col ${
                isFullscreen
                  ? "bg-background h-screen w-screen"
                  : ""
              }`}
            >
              {/* Video player - in fullscreen takes remaining space */}
              <div className={isFullscreen ? "flex-1 min-h-0" : ""}>
                <VideoPlayer
                  src={videoSrc}
                  fileName={videoName}
                  colorCount={colorCount}
                  onColorsExtracted={handleColorsExtracted}
                  onRemove={handleRemove}
                  fullscreenContainerRef={fullscreenContainerRef}
                  isExternalFullscreen={isFullscreen}
                />
              </div>

              {/* Live palette - thin strip */}
              <div
                aria-live="polite"
                aria-label="Current color palette"
                className={isFullscreen ? "shrink-0" : ""}
              >
                <PaletteBar colors={colors} compact={isFullscreen} />
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border" role="contentinfo">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Real-time color extraction</span>
          <span className="hidden sm:inline">
            All processing happens locally in your browser
          </span>
        </div>
      </footer>
    </div>
  );
}
