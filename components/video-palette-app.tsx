"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { type RGB, type CropBounds, type ExtractionSettings, DEFAULT_EXTRACTION_SETTINGS, lerpColors, matchColorOrder } from "@/lib/color-extractor";
import { VideoDropzone } from "./video-dropzone";
import { VideoPlayer } from "./video-player";
import { PaletteBar } from "./palette-bar";
import { ColorCountSelector } from "./color-count-selector";
import { ExportPanel } from "./export-panel";
import { ThemeToggle } from "./theme-toggle";
import { Film, Settings2, ChevronDown, RotateCcw } from "lucide-react";

// --- Extraction controls UI ---

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      <span className="ml-1.5 w-[14px] h-[14px] rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center cursor-help select-none leading-none shrink-0">
        ?
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 px-3 py-2 rounded-lg bg-popover border border-border text-xs text-popover-foreground shadow-lg pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 leading-relaxed">
        {text}
      </span>
    </span>
  );
}

function SliderRow({
  label, tooltip, min, max, step, value, displayValue, onChange,
}: {
  label: string;
  tooltip: string;
  min: number; max: number; step: number;
  value: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-foreground">
          {label}
          <InfoTooltip text={tooltip} />
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
      />
    </div>
  );
}

function ExtractionControls({
  settings,
  onChange,
  sidebar = false,
}: {
  settings: ExtractionSettings;
  onChange: (s: ExtractionSettings) => void;
  sidebar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isDefault =
    settings.deadband === DEFAULT_EXTRACTION_SETTINGS.deadband &&
    settings.blendFactor === DEFAULT_EXTRACTION_SETTINGS.blendFactor &&
    settings.minClusterSize === DEFAULT_EXTRACTION_SETTINGS.minClusterSize &&
    settings.minColorDist === DEFAULT_EXTRACTION_SETTINGS.minColorDist &&
    settings.saturationWeight === DEFAULT_EXTRACTION_SETTINGS.saturationWeight &&
    settings.contrastWeight === DEFAULT_EXTRACTION_SETTINGS.contrastWeight;
  const update = (key: keyof ExtractionSettings, value: number) =>
    onChange({ ...settings, [key]: value });

  const sliders = (
    <>
      <SliderRow
        label="Stabilità"
        tooltip="Soglia di variazione prima che la palette si aggiorni. Alta → solo i veri cambi di scena aggiornano i colori. Bassa → anche piccole variazioni vengono catturate."
        min={0} max={80} step={1}
        value={settings.deadband}
        displayValue={String(settings.deadband)}
        onChange={(v) => update("deadband", v)}
      />
      <SliderRow
        label="Velocità"
        tooltip="Con che rapidità cambiano i colori tra un frame e l'altro. Alta → aggiornamento quasi istantaneo. Bassa → transizione morbida e graduale."
        min={0.05} max={1.0} step={0.05}
        value={settings.blendFactor}
        displayValue={Math.round(settings.blendFactor * 100) + "%"}
        onChange={(v) => update("blendFactor", Math.round(v * 20) / 20)}
      />
      <SliderRow
        label="Presenza minima"
        tooltip="Quanto spazio deve occupare un colore nel frame per entrare nella palette. Alta → solo i colori dominanti. Bassa → include anche toni presenti in piccole aree."
        min={0} max={10} step={0.5}
        value={Math.round(settings.minClusterSize * 1000) / 10}
        displayValue={(Math.round(settings.minClusterSize * 1000) / 10).toFixed(1) + "%"}
        onChange={(v) => update("minClusterSize", v / 100)}
      />
      <SliderRow
        label="Diversità"
        tooltip="Quanto devono differire i colori estratti tra loro. Alta → palette con toni molto distanti. Bassa → include anche sfumature simili."
        min={10} max={60} step={5}
        value={settings.minColorDist}
        displayValue={String(settings.minColorDist)}
        onChange={(v) => update("minColorDist", v)}
      />
      <SliderRow
        label="Peso saturazione"
        tooltip="I pixel più saturi vengono campionati con più frequenza. Alto → i toni vividi dominano la palette. Zero → peso uniforme."
        min={0} max={3} step={0.25}
        value={settings.saturationWeight}
        displayValue={settings.saturationWeight.toFixed(2)}
        onChange={(v) => update("saturationWeight", v)}
      />
      <SliderRow
        label="Peso contrasto"
        tooltip="I pixel ad alto contrasto locale vengono campionati con più frequenza. Alto → la palette privilegia bordi netti e transizioni cromatiche."
        min={0} max={3} step={0.25}
        value={settings.contrastWeight}
        displayValue={settings.contrastWeight.toFixed(2)}
        onChange={(v) => update("contrastWeight", v)}
      />
      {!isDefault && (
        <button
          onClick={() => onChange(DEFAULT_EXTRACTION_SETTINGS)}
          className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Ripristina predefiniti
        </button>
      )}
    </>
  );

  if (sidebar) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Impostazioni</span>
        </div>
        {sliders}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors ${open ? "rounded-t-xl" : "rounded-xl"}`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          Impostazioni avanzate
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-border flex flex-col gap-4">
          {sliders}
        </div>
      )}
    </div>
  );
}

// ---

const DEFAULT_COLORS: RGB[] = [
  { r: 30, g: 30, b: 40 },
  { r: 60, g: 55, b: 70 },
  { r: 100, g: 95, b: 110 },
  { r: 150, g: 145, b: 160 },
  { r: 200, g: 195, b: 210 },
];

const DEFAULT_CROP: CropBounds = { top: 0, bottom: 0, left: 0, right: 0 };

export function VideoPaletteApp() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [colors, setColors] = useState<RGB[]>(DEFAULT_COLORS);
  const [colorCount, setColorCount] = useState(5);
  const [userCrop, setUserCrop] = useState<CropBounds>(DEFAULT_CROP);
  const [extractionSettings, setExtractionSettings] = useState<ExtractionSettings>(DEFAULT_EXTRACTION_SETTINGS);
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
    setUserCrop(DEFAULT_CROP);
  }, []);

  const handleCropChange = useCallback((crop: CropBounds) => {
    setUserCrop(crop);
  }, []);

  const handleColorsExtracted = useCallback(
    (newColors: RGB[]) => {
      const matched = matchColorOrder(latestColorsRef.current, newColors);
      const blend = reducedMotion
        ? Math.min(extractionSettings.blendFactor, 0.15)
        : extractionSettings.blendFactor;
      const smoothed = lerpColors(latestColorsRef.current, matched, blend, 5);
      setColors(smoothed);
      latestColorsRef.current = smoothed;
    },
    [reducedMotion, extractionSettings]
  );

  const handleRemove = useCallback(() => {
    if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setVideoName("");
    setColors(DEFAULT_COLORS);
    latestColorsRef.current = DEFAULT_COLORS;
    setUserCrop(DEFAULT_CROP);
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
                  userCrop={userCrop}
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
        className="flex-1 w-full mx-auto px-4 sm:px-6 py-6 sm:py-8"
        role="main"
      >
        {!videoSrc ? (
          <div className="max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center gap-8">
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
          <div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-6 xl:gap-8">
            {/* Video column */}
            <div className="flex-1 min-w-0">
              <div
                ref={fullscreenContainerRef}
                className={isFullscreen ? "bg-background h-screen w-screen flex flex-col" : ""}
              >
                <div className={isFullscreen ? "flex-1 min-h-0" : ""} aria-live="polite" aria-label="Video and color palette">
                  <VideoPlayer
                    src={videoSrc}
                    fileName={videoName}
                    colorCount={colorCount}
                    colors={colors}
                    userCrop={userCrop}
                    extractionSettings={extractionSettings}
                    onCropChange={handleCropChange}
                    onColorsExtracted={handleColorsExtracted}
                    onRemove={handleRemove}
                    fullscreenContainerRef={fullscreenContainerRef}
                    isExternalFullscreen={isFullscreen}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar: extraction controls */}
            {!isFullscreen && (
              <aside className="w-full xl:w-64 shrink-0 xl:border-l xl:border-border xl:pl-8 pt-1">
                <ExtractionControls
                  settings={extractionSettings}
                  onChange={setExtractionSettings}
                  sidebar
                />
              </aside>
            )}
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
