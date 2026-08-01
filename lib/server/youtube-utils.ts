import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  chmodSync,
  writeFileSync,
  statSync,
  createReadStream,
  readdirSync,
  unlinkSync,
} from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
// Static ffmpeg/ffprobe binaries bundled in node_modules — no system install needed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FFMPEG_PATH: string = require("ffmpeg-static") as string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FFPROBE_PATH: string = (require("@ffprobe-installer/ffprobe") as { path: string }).path;

const YTDLP_DIR = "/tmp/ytdlp-bin";
const YTDLP_PATH = `${YTDLP_DIR}/yt-dlp`;
const YTDLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const YT_CACHE_DIR = "/tmp/youtube-cache";
const YT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const YT_CACHE_MAX_BYTES = readPositiveInt(
  process.env.YT_CACHE_MAX_BYTES,
  2 * 1024 * 1024 * 1024
);
const DEFAULT_YOUTUBE_EXTRACTOR_ARGS = [
  null,
  "youtube:player_client=ios",
  "youtube:player_client=mweb",
  "youtube:player_client=android",
  "youtube:player_client=tv",
  "youtube:player_client=tv_embedded",
];

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  streamUrl: string | null;
  hasAudio: boolean;
  fallbackMode?: "thumbnail";
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function readPositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function readTrimmedEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

function buildYtDlpRuntimeArgs(): string[] {
  const configuredRuntime = readTrimmedEnv("YTDLP_JS_RUNTIME");
  const runtime = configuredRuntime || `node:${process.execPath}`;

  return runtime ? ["--js-runtimes", runtime] : [];
}

function buildYtDlpOptionalArgs(extractorArgs: string | null): string[] {
  const args: string[] = [...buildYtDlpRuntimeArgs()];

  const cookiesFile = readTrimmedEnv("YTDLP_COOKIES_FILE");
  if (cookiesFile) {
    if (existsSync(cookiesFile)) {
      args.push("--cookies", cookiesFile);
    } else {
      console.warn(`[youtube] YTDLP_COOKIES_FILE not found: ${cookiesFile}`);
    }
  }

  const cookiesFromBrowser = readTrimmedEnv("YTDLP_COOKIES_FROM_BROWSER");
  if (cookiesFromBrowser) {
    args.push("--cookies-from-browser", cookiesFromBrowser);
  }

  if (extractorArgs) {
    args.push("--extractor-args", extractorArgs);
  }

  return args;
}

function buildYtDlpCommand(binary: string, args: string[]): string {
  return [shellQuote(binary), ...args.map(shellQuote)].join(" ");
}

function getExtractorArgStrategies(): Array<string | null> {
  const configured = readTrimmedEnv("YTDLP_EXTRACTOR_ARGS");
  const strategies: Array<string | null> = configured ? [configured] : [null];

  for (const strategy of DEFAULT_YOUTUBE_EXTRACTOR_ARGS) {
    if (!strategies.includes(strategy)) {
      strategies.push(strategy);
    }
  }

  return strategies;
}

function extractorLabel(extractorArgs: string | null): string {
  return extractorArgs || "default";
}

function getErrorText(error: unknown): string {
  const err = error as {
    message?: string;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };
  const parts = [err.stderr, err.stdout, err.message]
    .map((part) => {
      if (!part) return "";
      return Buffer.isBuffer(part) ? part.toString() : String(part);
    })
    .filter(Boolean);

  return parts.join("\n").trim();
}

function shouldTryNextExtractor(errorText: string): boolean {
  const lower = errorText.toLowerCase();

  if (
    lower.includes("private video") ||
    lower.includes("copyright") ||
    lower.includes("this video is not available")
  ) {
    return false;
  }

  return [
    "sign in to confirm",
    "not a bot",
    "http error 403",
    "precondition check failed",
    "requested format is not available",
    "nsig extraction failed",
  ].some((needle) => lower.includes(needle));
}

export function isYouTubeServerAccessBlocked(errorText: string): boolean {
  const lower = errorText.toLowerCase();

  return [
    "sign in to confirm",
    "not a bot",
    "http error 403",
    "no title found in player responses",
    "precondition check failed",
  ].some((needle) => lower.includes(needle));
}

function summarizeYtDlpError(errorText: string): string {
  const firstLine = errorText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || "unknown yt-dlp error").slice(0, 240);
}

function execYtDlpWithExtractorRetries(
  binary: string,
  context: string,
  makeArgs: (extractorArgs: string | null) => string[],
  options: {
    timeout: number;
    maxBuffer: number;
  },
  beforeAttempt?: () => void
): string {
  const failures: string[] = [];
  let lastErrorText = "";

  for (const extractorArgs of getExtractorArgStrategies()) {
    beforeAttempt?.();
    const label = extractorLabel(extractorArgs);
    const cmd = buildYtDlpCommand(binary, makeArgs(extractorArgs));

    try {
      console.log(`[youtube] ${context} using yt-dlp strategy: ${label}`);
      return execSync(cmd, {
        encoding: "utf-8",
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
      });
    } catch (error) {
      lastErrorText = getErrorText(error);
      failures.push(`${label}: ${summarizeYtDlpError(lastErrorText)}`);

      if (!shouldTryNextExtractor(lastErrorText)) {
        break;
      }
    }
  }

  throw new Error(
    `${context} failed after ${failures.length} yt-dlp strategy attempt(s): ` +
      failures.join(" | ") +
      (lastErrorText ? `\n${lastErrorText}` : "")
  );
}

export function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

function ensureFfmpegTools(): void {
  if (!FFMPEG_PATH || !existsSync(FFMPEG_PATH)) {
    throw new Error(`ffmpeg-static binary not found at: ${FFMPEG_PATH}`);
  }
  if (!FFPROBE_PATH || !existsSync(FFPROBE_PATH)) {
    throw new Error(`ffprobe binary not found at: ${FFPROBE_PATH}`);
  }
}

function getMergedVideoPath(videoId: string): string {
  return `${YT_CACHE_DIR}/${videoId}.mp4`;
}

function isFreshCacheFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const st = statSync(filePath);
  if (st.size <= 0) return false;
  return Date.now() - st.mtimeMs < YT_CACHE_TTL_MS;
}

function cleanupOldCachedVideos() {
  if (!existsSync(YT_CACHE_DIR)) return;
  const now = Date.now();
  for (const entry of readdirSync(YT_CACHE_DIR)) {
    if (!entry.endsWith(".mp4")) continue;
    const fullPath = `${YT_CACHE_DIR}/${entry}`;
    try {
      const st = statSync(fullPath);
      if (now - st.mtimeMs > YT_CACHE_TTL_MS) {
        unlinkSync(fullPath);
      }
    } catch {
      // Ignore stale file cleanup errors.
    }
  }
}

interface CacheEntry {
  path: string;
  size: number;
  mtimeMs: number;
}

function listCacheEntries(): CacheEntry[] {
  if (!existsSync(YT_CACHE_DIR)) return [];
  const entries: CacheEntry[] = [];
  for (const fileName of readdirSync(YT_CACHE_DIR)) {
    if (!fileName.endsWith(".mp4")) continue;
    const path = `${YT_CACHE_DIR}/${fileName}`;
    try {
      const st = statSync(path);
      if (st.size <= 0) continue;
      entries.push({ path, size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      // ignore transient file system errors
    }
  }
  return entries;
}

function enforceCacheSizeLimit(excludePath?: string) {
  const entries = listCacheEntries().sort((a, b) => a.mtimeMs - b.mtimeMs);
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);

  for (const entry of entries) {
    if (total <= YT_CACHE_MAX_BYTES) break;
    if (excludePath && entry.path === excludePath) continue;
    try {
      unlinkSync(entry.path);
      total -= entry.size;
    } catch {
      // ignore deletion errors and continue with other files
    }
  }
}


function validateMergedFileWithFfprobe(filePath: string) {
  const output = execSync(
    `"${FFPROBE_PATH}" -v error -show_entries stream=codec_type -of csv=p=0 "${filePath}"`,
    { encoding: "utf-8", timeout: 30_000 }
  );
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasVideo = lines.includes("video");
  const hasAudio = lines.includes("audio");

  if (!hasVideo || !hasAudio) {
    throw new Error(
      `Merged file validation failed (hasVideo=${hasVideo}, hasAudio=${hasAudio})`
    );
  }
}

function isExecutable(cmd: string): boolean {
  try {
    execSync(`"${cmd}" --version`, { stdio: "ignore", timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureYtDlp(): Promise<string> {
  // 1. Prefer system yt-dlp (installed via nixpacks on Railway — no /tmp issues).
  if (isExecutable("yt-dlp")) {
    const version = execSync("yt-dlp --version", { encoding: "utf-8" }).trim();
    console.log(`[youtube] Using system yt-dlp ${version}`);
    return "yt-dlp";
  }

  // 2. Check if a previously downloaded binary is still executable.
  //    (It may exist but be non-executable if /tmp is mounted noexec.)
  if (existsSync(YTDLP_PATH)) {
    if (isExecutable(YTDLP_PATH)) return YTDLP_PATH;
    console.warn("[youtube] Cached yt-dlp binary is not executable — removing and re-downloading");
    unlinkSync(YTDLP_PATH);
  }

  // 3. Download from GitHub as last resort.
  ensureDir(YTDLP_DIR);
  console.log("[youtube] Downloading yt-dlp binary...");
  const res = await fetch(YTDLP_URL);
  if (!res.ok) throw new Error(`Failed to download yt-dlp: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(YTDLP_PATH, buffer);
  chmodSync(YTDLP_PATH, 0o755);

  if (!isExecutable(YTDLP_PATH)) {
    throw new Error(
      `yt-dlp binary is not executable at ${YTDLP_PATH}. ` +
        "This usually means /tmp is mounted noexec. " +
        "Ensure nixpacks.toml includes yt-dlp in nixPkgs so it is installed system-wide."
    );
  }

  const version = execSync(`"${YTDLP_PATH}" --version`, { encoding: "utf-8" }).trim();
  console.log(`[youtube] yt-dlp ${version} ready`);
  return YTDLP_PATH;
}

async function fetchYouTubeThumbnail(videoId: string): Promise<Buffer> {
  const thumbnailUrls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];

  for (const url of thumbnailUrls) {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.startsWith("image/")) continue;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 0) return buffer;
  }

  throw new Error("Could not fetch YouTube thumbnail fallback");
}

async function createThumbnailFallbackVideo(
  videoId: string,
  mergedPath: string
): Promise<string> {
  ensureFfmpegTools();
  ensureDir(YT_CACHE_DIR);

  const thumbnailPath = `${YT_CACHE_DIR}/${videoId}.jpg`;
  const thumbnail = await fetchYouTubeThumbnail(videoId);
  writeFileSync(thumbnailPath, thumbnail);

  if (existsSync(mergedPath)) {
    unlinkSync(mergedPath);
  }

  const cmd = [
    shellQuote(FFMPEG_PATH),
    "-y",
    "-loop",
    "1",
    "-i",
    shellQuote(thumbnailPath),
    "-f",
    "lavfi",
    "-i",
    shellQuote("anullsrc=channel_layout=stereo:sample_rate=44100"),
    "-t",
    "2",
    "-vf",
    shellQuote("scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p"),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    shellQuote(mergedPath),
  ].join(" ");

  console.warn(`[youtube] Creating thumbnail fallback MP4 for ${videoId}`);
  execSync(cmd, {
    encoding: "utf-8",
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  validateMergedFileWithFfprobe(mergedPath);
  return mergedPath;
}

export async function ensureMergedVideo(videoId: string): Promise<string> {
  ensureDir(YT_CACHE_DIR);
  cleanupOldCachedVideos();
  enforceCacheSizeLimit();

  const mergedPath = getMergedVideoPath(videoId);
  if (isFreshCacheFile(mergedPath)) {
    return mergedPath;
  }

  const ytdlp = await ensureYtDlp();
  ensureFfmpegTools();

  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Do not force mp4-only sources here: many YouTube 2160p streams are vp9/webm.
  // yt-dlp + ffmpeg will still output a merged mp4 when possible.
  const formatStr = "bestvideo[height<=2160]+bestaudio/bestvideo+bestaudio/best";
  try {
    execYtDlpWithExtractorRetries(
      ytdlp,
      `download and merge ${videoId}`,
      (extractorArgs) => [
        "--no-playlist",
        "--no-progress",
        "--no-warnings",
        ...buildYtDlpOptionalArgs(extractorArgs),
        "--ffmpeg-location",
        FFMPEG_PATH,
        "-f",
        formatStr,
        "--merge-output-format",
        "mp4",
        "--output",
        mergedPath,
        sourceUrl,
      ],
      {
        timeout: 4 * 60_000,
        maxBuffer: 10 * 1024 * 1024,
      },
      () => {
        if (existsSync(mergedPath)) {
          unlinkSync(mergedPath);
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : getErrorText(error);
    if (!isYouTubeServerAccessBlocked(message)) {
      throw error;
    }

    console.warn(
      `[youtube] yt-dlp blocked for ${videoId}; using thumbnail fallback`
    );
    return createThumbnailFallbackVideo(videoId, mergedPath);
  }

  if (!existsSync(mergedPath) || statSync(mergedPath).size <= 0) {
    throw new Error("Merged video file was not created");
  }

  validateMergedFileWithFfprobe(mergedPath);

  enforceCacheSizeLimit(mergedPath);
  return mergedPath;
}

export async function getYouTubeFallbackVideoInfo(
  videoId: string
): Promise<YouTubeVideoInfo> {
  let title = `YouTube ${videoId}`;

  try {
    const oembedUrl =
      `https://www.youtube.com/oembed?format=json&url=` +
      encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.title === "string" && data.title.trim()) {
        title = `${data.title.trim()} (thumbnail preview)`;
      }
    }
  } catch {
    // Keep the deterministic fallback title.
  }

  return {
    videoId,
    title,
    duration: 2,
    streamUrl: null,
    width: 0,
    height: 0,
    hasAudio: true,
    fallbackMode: "thumbnail",
  };
}

export function streamLocalMp4(filePath: string): NextResponse {
  const st = statSync(filePath);
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(st.size),
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function getYouTubeVideoInfo(
  videoId: string
): Promise<YouTubeVideoInfo> {
  const ytdlp = await ensureYtDlp();

  const formatStr =
    "best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/b[ext=mp4][vcodec!=none][acodec!=none]/b[vcodec!=none][acodec!=none]";

  const output = execYtDlpWithExtractorRetries(
    ytdlp,
    `load metadata ${videoId}`,
    (extractorArgs) => [
      "-j",
      "--no-download",
      ...buildYtDlpOptionalArgs(extractorArgs),
      "-f",
      formatStr,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const data = JSON.parse(output);

  let streamUrl = typeof data.url === "string" ? data.url : "";
  const title = data.title || `youtube-${videoId}`;
  const duration = data.duration || 0;
  const width = data.width || 0;
  const height = data.height || 0;
  const acodec = typeof data.acodec === "string" ? data.acodec : "none";
  const vcodec = typeof data.vcodec === "string" ? data.vcodec : "none";

  if (
    (!streamUrl || acodec === "none" || vcodec === "none") &&
    Array.isArray(data.requested_formats)
  ) {
    const muxed = data.requested_formats.find(
      (f: { url?: string; acodec?: string; vcodec?: string }) =>
        typeof f?.url === "string" &&
        f?.acodec &&
        f?.acodec !== "none" &&
        f?.vcodec &&
        f?.vcodec !== "none"
    );
    if (muxed?.url) {
      streamUrl = muxed.url;
    }
  }

  return {
    videoId,
    title,
    duration,
    streamUrl: streamUrl || null,
    width,
    height,
    hasAudio: acodec !== "none",
  };
}
