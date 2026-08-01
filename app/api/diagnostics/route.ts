import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { ensureYtDlp, getYouTubeVideoInfo } from "@/lib/server/youtube-utils";

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

  // --- yt-dlp: prefer system when present, otherwise use the app resolver. ---
  checks.ytdlp_system = run("command -v yt-dlp");
  checks.ytdlp_system_version = run("yt-dlp --version");

  const ytdlpPath = "/tmp/ytdlp-bin/yt-dlp";
  checks.ytdlp_tmp_exists = {
    ok: existsSync(ytdlpPath),
    output: existsSync(ytdlpPath) ? "present" : "not found",
  };

  let ytdlpActive: string | null = null;
  try {
    ytdlpActive = await ensureYtDlp();
    checks.ytdlp_resolved = {
      ok: true,
      output: ytdlpActive === "yt-dlp" ? "system yt-dlp" : ytdlpActive,
    };
    checks.ytdlp_tmp_exists = {
      ok: existsSync(ytdlpPath),
      output: existsSync(ytdlpPath) ? "present" : "not found",
    };
    const versionCmd = ytdlpActive === "yt-dlp" ? "yt-dlp" : `"${ytdlpActive}"`;
    checks.ytdlp_version = run(`${versionCmd} --version`);
  } catch (e: unknown) {
    const err = e as { message?: string };
    checks.ytdlp_resolved = {
      ok: false,
      output: err.message?.slice(0, 400) || "failed to resolve yt-dlp",
    };
  }

  if (ytdlpActive) {
    try {
      const info = await getYouTubeVideoInfo("jNQXAC9IVRw");
      checks.ytdlp_yt_connectivity = {
        ok: true,
        output: `${info.title} | ${info.duration}s | stream=${Boolean(info.streamUrl)}`,
      };
    } catch (e: unknown) {
      const err = e as { message?: string };
      checks.ytdlp_yt_connectivity = {
        ok: false,
        output: err.message?.slice(0, 400) || "YouTube probe failed",
      };
    }
  }

  const optionalChecks = new Set([
    "ytdlp_system",
    "ytdlp_system_version",
    "ytdlp_tmp_exists",
  ]);
  const allOk = Object.entries(checks)
    .filter(([key]) => !optionalChecks.has(key))
    .every(([, check]) => check.ok);

  return NextResponse.json({
    ok: allOk,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    checks,
  });
}
