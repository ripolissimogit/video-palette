import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync } from "fs";

const BIN_DIR = "/tmp/ytdlp-bin";
const YTDLP_PATH = `${BIN_DIR}/yt-dlp`;
// Use the standalone Linux binary (not the Python zipapp)
const DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

// Create bin directory
if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true });
  console.log("Created bin/ directory at", BIN_DIR);
}

// Download yt-dlp standalone Linux binary
if (!existsSync(YTDLP_PATH)) {
  console.log("Downloading yt-dlp standalone Linux binary...");
  console.log("URL:", DOWNLOAD_URL);
  execSync(
    `curl -L --fail -o "${YTDLP_PATH}" "${DOWNLOAD_URL}"`,
    { stdio: "inherit", timeout: 60000 }
  );
  chmodSync(YTDLP_PATH, 0o755);
  console.log("Downloaded and made executable:", YTDLP_PATH);
} else {
  console.log("yt-dlp already exists at", YTDLP_PATH);
}

// Verify binary works
try {
  const version = execSync(`"${YTDLP_PATH}" --version`, { encoding: "utf-8" }).trim();
  console.log("yt-dlp version:", version);
} catch (err) {
  console.error("Version check failed:", err.message);
  if (err.stderr) console.error(err.stderr.toString());
  process.exit(1);
}

// Quick test: fetch metadata only (no download)
console.log("\nTesting metadata fetch for YouTube video...");
try {
  const result = execSync(
    `"${YTDLP_PATH}" -j --no-download --extractor-args "youtube:player_client=mweb" "https://www.youtube.com/watch?v=jNQXAC9IVRw"`,
    { encoding: "utf-8", timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
  );
  const data = JSON.parse(result);
  console.log("Title:", data.title);
  console.log("Duration:", data.duration, "s");
  console.log("Formats:", data.formats?.length || 0);
  console.log("yt-dlp is working!");
} catch (err) {
  console.error("Metadata test failed:", err.message);
  if (err.stderr) console.error(err.stderr.toString().slice(0, 500));
}
