import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "fs";

export const dynamic = "force-dynamic";

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
    return { ok: true, output: `writable` };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, output: err.message ?? "not writable" };
  }
}

// GET /api/diagnostics
// Verifies the health of ffmpeg, ffprobe, yt-dlp, and /tmp on the Railway host.
export async function GET() {
  const checks: Record<string, { ok: boolean; output: string }> = {};

  // --- ffmpeg / ffprobe ---
  checks.ffmpeg_which   = run("which ffmpeg");
  checks.ffmpeg_version = run("ffmpeg -version 2>&1 | head -1");
  checks.ffprobe_which  = run("which ffprobe");
  checks.ffprobe_version = run("ffprobe -version 2>&1 | head -1");

  // --- filesystem ---
  checks.tmp_writable      = checkWritable("/tmp");
  checks.ytdlp_bin_dir     = checkWritable("/tmp/ytdlp-bin");
  checks.youtube_cache_dir = checkWritable("/tmp/youtube-cache");
  checks.jobs_store_dir    = checkWritable("/tmp/youtube-merge-jobs");

  // --- yt-dlp binary ---
  const ytdlpPath = "/tmp/ytdlp-bin/yt-dlp";
  checks.ytdlp_exists = {
    ok: existsSync(ytdlpPath),
    output: existsSync(ytdlpPath) ? "present" : "not found (will be downloaded on first YouTube request)",
  };

  if (existsSync(ytdlpPath)) {
    checks.ytdlp_version    = run(`"${ytdlpPath}" --version`);
    checks.ytdlp_executable = run(`test -x "${ytdlpPath}" && echo "executable" || echo "not executable"`);

    // Connectivity test: fetch title + duration of a 18-second public video.
    // Uses --print to avoid downloading or parsing large JSON.
    const ytTestResult = run(
      `"${ytdlpPath}" --no-playlist --no-warnings --no-progress ` +
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
