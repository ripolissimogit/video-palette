import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "fs";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FFMPEG_PATH: string = require("ffmpeg-static") as string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FFPROBE_PATH: string = (require("@ffprobe-installer/ffprobe") as { path: string }).path;

function run(cmd: string, opts?: { timeout?: number }): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: opts?.timeout ?? 15_000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, output };
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string | Buffer };
    const detail = (typeof err.stderr === "string"
      ? err.stderr
      : err.stderr instanceof Buffer
        ? err.stderr.toString()
        : err.message || "unknown error"
    ).trim();
    return { ok: false, output: detail.slice(0, 400) };
  }
}

function checkWritable(dir: string): { ok: boolean; output: string } {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = `${dir}/.write-probe`;
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return { ok: true, output: "writable" };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, output: err.message ?? "not writable" };
  }
}

// GET /api/diagnostics
// Verifies the health of ffmpeg, ffprobe (npm static binaries), yt-dlp, and /tmp.
export async function GET() {
  const checks: Record<string, { ok: boolean; output: string }> = {};

  // --- ffmpeg (npm static binary) ---
  checks.ffmpeg_path   = { ok: !!FFMPEG_PATH,   output: FFMPEG_PATH   || "not resolved" };
  checks.ffmpeg_exists = { ok: existsSync(FFMPEG_PATH), output: existsSync(FFMPEG_PATH) ? "present" : "missing" };
  checks.ffmpeg_version = run(`"${FFMPEG_PATH}" -version 2>&1 | head -1`);

  // --- ffprobe (npm static binary) ---
  checks.ffprobe_path   = { ok: !!FFPROBE_PATH,   output: FFPROBE_PATH   || "not resolved" };
  checks.ffprobe_exists = { ok: existsSync(FFPROBE_PATH), output: existsSync(FFPROBE_PATH) ? "present" : "missing" };
  checks.ffprobe_version = run(`"${FFPROBE_PATH}" -version 2>&1 | head -1`);

  // --- filesystem ---
  checks.tmp_writable      = checkWritable("/tmp");
  checks.ytdlp_bin_dir     = checkWritable("/tmp/ytdlp-bin");
  checks.youtube_cache_dir = checkWritable("/tmp/youtube-cache");
  checks.jobs_store_dir    = checkWritable("/tmp/youtube-merge-jobs");

  // --- yt-dlp binary ---
  const ytdlpPath = "/tmp/ytdlp-bin/yt-dlp";
  checks.ytdlp_exists = {
    ok: existsSync(ytdlpPath),
    output: existsSync(ytdlpPath)
      ? "present"
      : "not found (downloaded automatically on first YouTube request)",
  };

  if (existsSync(ytdlpPath)) {
    checks.ytdlp_version = run(`"${ytdlpPath}" --version`);

    // Connectivity test: fetch title + duration of a short public video.
    const ytTestResult = run(
      `"${ytdlpPath}" --no-playlist --no-warnings --no-progress ` +
        `--ffmpeg-location "${FFMPEG_PATH}" ` +
        `--print "%(title)s | %(duration)ss" ` +
        `-f "best[ext=mp4][vcodec!=none][acodec!=none]/best" ` +
        `"https://www.youtube.com/watch?v=jNQXAC9IVRw"`,
      { timeout: 30_000 }
    );
    checks.ytdlp_yt_connectivity = ytTestResult;
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({
    ok: allOk,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    checks,
  });
}
