import assert from "node:assert/strict";
import test from "node:test";
import { getVideoPaletteApiUrl } from "./video-palette-origin.ts";

test("uses the Video Palette origin only when embedded under colorificio.app", () => {
  assert.equal(
    getVideoPaletteApiUrl("/api/youtube", "colorificio.app"),
    "https://video-palette.vercel.app/api/youtube"
  );
  assert.equal(
    getVideoPaletteApiUrl("/api/youtube", "video-palette.vercel.app"),
    "/api/youtube"
  );
});
