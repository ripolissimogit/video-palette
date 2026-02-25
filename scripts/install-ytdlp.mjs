import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";

const BIN_DIR = join(process.cwd(), "bin");
const YTDLP_PATH = join(BIN_DIR, "yt-dlp");

// Create bin directory
if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true });
  console.log("Created bin/ directory");
}

// Download yt-dlp binary
if (!existsSync(YTDLP_PATH)) {
  console.log("Downloading yt-dlp binary...");
  execSync(
    `curl -L -o "${YTDLP_PATH}" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"`,
    { stdio: "inherit" }
  );
  chmodSync(YTDLP_PATH, 0o755);
  console.log("yt-dlp downloaded and made executable");
} else {
  console.log("yt-dlp already exists");
}

// Verify it works
try {
  const version = execSync(`"${YTDLP_PATH}" --version`, { encoding: "utf-8" }).trim();
  console.log(`yt-dlp version: ${version}`);
} catch (err) {
  console.error("Failed to run yt-dlp:", err.message);
  process.exit(1);
}

// Quick test: get video info (JSON) for a short public domain video
console.log("\nTesting with a short YouTube video...");
try {
  const info = execSync(
    `"${YTDLP_PATH}" --dump-json --no-download -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]" "https://www.youtube.com/watch?v=jNQXAC9IVRw"`,
    { encoding: "utf-8", timeout: 30000 }
  );
  const data = JSON.parse(info);
  console.log(`Title: ${data.title}`);
  console.log(`Duration: ${data.duration}s`);
  console.log(`Format: ${data.format}`);
  console.log(`URL available: ${!!data.url}`);
  console.log("\nyt-dlp is working correctly!");
} catch (err) {
  console.error("Test failed:", err.message);
  // Still ok - binary is installed, video might just be geo-restricted
}
