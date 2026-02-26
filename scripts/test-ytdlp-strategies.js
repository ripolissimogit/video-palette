import { execSync } from "child_process";
import { resolveYtDlpBinary } from "./_shared/ytdlp-resolver.mjs";

const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

const resolved = await resolveYtDlpBinary();
console.log(`[ytdlp] Using ${resolved.path} (${resolved.source})`);

const strategies = [
  { name: "default (no client override)", args: "" },
  { name: "player_client=tv", args: '--extractor-args "youtube:player_client=tv"' },
  { name: "player_client=tv_embedded", args: '--extractor-args "youtube:player_client=tv_embedded"' },
  { name: "player_client=mediaconnect", args: '--extractor-args "youtube:player_client=mediaconnect"' },
  { name: "player_client=ios", args: '--extractor-args "youtube:player_client=ios"' },
  { name: "player_client=android", args: '--extractor-args "youtube:player_client=android"' },
  { name: "player_client=web_creator", args: '--extractor-args "youtube:player_client=web_creator"' },
  { name: "geo-bypass + default", args: "--geo-bypass" },
];

let success = false;

for (const strategy of strategies) {
  console.log(`\n--- Strategy: ${strategy.name} ---`);
  try {
    const cmd = `"${resolved.path}" -j --no-download ${strategy.args} "${VIDEO}"`;
    console.log("CMD:", cmd);
    const result = execSync(cmd, {
      encoding: "utf-8",
      timeout: 20_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);
    console.log("SUCCESS! Title:", data.title);
    console.log("Formats:", data.formats?.length || 0);
    console.log("Has URL:", !!data.url);
    success = true;
    break;
  } catch (error) {
    const err = error;
    const stderr =
      err?.stderr?.toString() || err?.stdout?.toString() || err?.message || "";
    if (stderr.includes("bot")) {
      console.log("BLOCKED: bot detection");
    } else if (stderr.includes("unavailable")) {
      console.log("BLOCKED: video unavailable");
    } else {
      console.log("FAILED:", stderr.slice(0, 200));
    }
  }
}

if (!success) {
  console.error("No yt-dlp strategy succeeded.");
  process.exitCode = 1;
}
