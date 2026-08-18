import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The public Colorificio route is a Cloudflare proxy. Keep the app's assets
  // on its dedicated Vercel origin so they cannot collide with the main site.
  assetPrefix: process.env.VERCEL ? "https://video-palette.vercel.app" : undefined,
  images: {
    unoptimized: true,
  },
  // Prevent bundling of server-only binary packages (ffmpeg, ffprobe).
  // These are resolved at runtime from node_modules on the server.
  serverExternalPackages: ["ffmpeg-static", "@ffprobe-installer/ffprobe"],
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
