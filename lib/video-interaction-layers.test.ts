import assert from "node:assert/strict";
import test from "node:test";
import { VIDEO_INTERACTION_LAYERS } from "./video-interaction-layers.ts";

test("the remove control and crop handles remain above the movable crop surface", () => {
  assert.ok(VIDEO_INTERACTION_LAYERS.remove > VIDEO_INTERACTION_LAYERS.cropHandle);
  assert.ok(VIDEO_INTERACTION_LAYERS.cropHandle > VIDEO_INTERACTION_LAYERS.cropMoveSurface);
});

test("the native file input receives the pointer above the upload decoration", () => {
  assert.ok(VIDEO_INTERACTION_LAYERS.fileInput > 0);
});
