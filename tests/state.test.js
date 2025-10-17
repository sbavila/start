import assert from "node:assert/strict";
import { state } from "../assets/js/state.js";

assert.ok(Array.isArray(state.themes) && state.themes.length > 0, "state.themes should list available themes");
assert.ok(state.themeLinks instanceof Map, "state.themeLinks should be a Map for preloaded stylesheets");

const originalAliases = state.BOOKMARK_ALIASES;

try {
  state.LINK_ALIASES = { sample: "https://example.com" };
  assert.strictEqual(
    state.BOOKMARK_ALIASES.sample,
    "https://example.com",
    "state.LINK_ALIASES setter should populate BOOKMARK_ALIASES"
  );

  state.BOOKMARK_ALIASES = Object.create(null);
  assert.deepStrictEqual(
    state.LINK_ALIASES,
    state.BOOKMARK_ALIASES,
    "state.LINK_ALIASES getter should read from BOOKMARK_ALIASES"
  );
} finally {
  state.BOOKMARK_ALIASES = originalAliases;
}

console.log("✓ state module invariants passed");
