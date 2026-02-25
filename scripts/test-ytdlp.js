import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const YTDLP = join(process.env.HOME, "bin", "yt-dlp");
const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

// Find node path for JS runtime
const nodePath = execSync("which node").toString().trim();
console.log("Node.js path:", nodePath);

// Test different strategies
const strategies = [
  {
    name: "nodejs runtime + ios client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=ios"`,
  },
  {
    name: "nodejs runtime + android client", 
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=android"`,
  },
  {
    name: "nodejs runtime + mweb client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=mweb"`,
  },
  {
    name: "nodejs runtime + tv client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=tv"`,
  },
  {
    name: "nodejs runtime + default clients",
    args: `--js-runtimes nodejs:${nodePath}`,
  },
];

for (const strategy of strategies) {
  console.log(`\n--- Testing: ${strategy.name} ---`);
  const cmd = `"${YTDLP}" ${strategy.args} --dump-json --no-download -f "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]" "${VIDEO}" 2>&1`;
  try {
    const output = execSync(cmd, { timeout: 30000, encoding: "utf-8" });
    // Try to parse just the JSON part (skip warnings)
    const lines = output.split("\n");
    const jsonLine = lines.find(l => l.trim().startsWith("{"));
    if (jsonLine) {
      const data = JSON.parse(jsonLine);
      console.log("SUCCESS! Title:", data.title);
      console.log("Format:", data.format);
      console.log("URL available:", !!data.url);
      console.log("Requested formats:", data.requested_formats?.length || 0);
      if (data.requested_formats) {
        data.requested_formats.forEach((f, i) => {
          console.log(`  Format ${i}: ${f.format} | ext: ${f.ext} | vcodec: ${f.vcodec} | acodec: ${f.acodec}`);
        });
      }
      break; // Success, stop trying
    } else {
      console.log("No JSON found in output. Raw output:");
      console.log(output.substring(0, 500));
    }
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.log("FAILED:", stderr.substring(0, 400));
  }
}
