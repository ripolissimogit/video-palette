const VIDEO_PALETTE_ORIGIN = "https://video-palette.vercel.app";

export function getVideoPaletteApiUrl(path: string, hostname = typeof window === "undefined" ? "" : window.location.hostname) {
  if (!path.startsWith("/")) return path;

  return hostname === "colorificio.app" || hostname === "www.colorificio.app"
    ? `${VIDEO_PALETTE_ORIGIN}${path}`
    : path;
}
