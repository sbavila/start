import assert from "node:assert/strict";
import {
  normalizeImportedOverlay,
  addBookmark,
  removeBookmark,
  renameBookmark,
  hideBookmark,
  unhideBookmark,
  mergeWithOverlay,
  setSort,
  setGroupSortMode,
  applyOrder,
  resetOrder,
} from "../assets/js/bookmarks.js";

const BASELINE = {
  sections: [
    {
      title: "Downtime",
      items: [
        { label: "Hacker News", url: "https://news.ycombinator.com" },
        { label: "Reddit", url: "https://reddit.com" },
      ],
    },
    {
      title: "Productivity",
      items: [
        { label: "Chat GPT", url: "https://chat.openai.com" },
        { label: "Linear", url: "https://linear.app" },
      ],
    },
  ],
};

function freshOverlay() {
  return normalizeImportedOverlay({});
}

// bm add → overlay bookmark appears in merge output under new group
{
  let overlay = freshOverlay();
  overlay = addBookmark(overlay, {
    label: "Zed",
    url: "https://zed.dev",
    group: "Downtime",
  });
  const merged = mergeWithOverlay(BASELINE, overlay);
  const downtime = merged.sections.find((section) => section.title === "Downtime");
  assert.ok(downtime, "Downtime group should exist after merge");
  assert.ok(
    downtime.items.some((item) => item.label === "Zed" && item.url === "https://zed.dev"),
    "Merged data should include overlay bookmark"
  );
}

// bm rm baseline bookmark should add to hide list (case-insensitive)
{
  let overlay = freshOverlay();
  overlay = removeBookmark(overlay, "hacker news");
  assert.ok(
    overlay.hide.some((entry) => entry.toLowerCase() === "hacker news"),
    "Removing baseline bookmark should hide it"
  );
  const merged = mergeWithOverlay(BASELINE, overlay);
  const downtime = merged.sections.find((section) => section.title === "Downtime");
  assert.ok(downtime, "Downtime group should remain present");
  assert.ok(
    !downtime.items.some((item) => item.label.toLowerCase() === "hacker news"),
    "Hidden bookmarks should be filtered from merge output"
  );
}

// bm mv should place bookmark in a new group while preserving URL
{
  let overlay = freshOverlay();
  overlay = addBookmark(overlay, {
    label: "Linear",
    url: "https://linear.app",
    group: "Focus",
  });
  const merged = mergeWithOverlay(BASELINE, overlay);
  const focus = merged.sections.find((section) => section.title === "Focus");
  assert.ok(focus, "New group Focus should be created by overlay");
  assert.ok(
    focus.items.some((item) => item.label === "Linear" && item.url === "https://linear.app"),
    "Bookmark should be moved into the overlay group"
  );
}

// bm ren should replace label and hide old one
{
  let overlay = freshOverlay();
  overlay = addBookmark(overlay, {
    label: "Chat GPT",
    url: "https://chat.openai.com",
    group: "Productivity",
  });
  overlay = renameBookmark(overlay, "Chat GPT", "ChatGPT");
  const merged = mergeWithOverlay(BASELINE, overlay);
  const productivity = merged.sections.find((section) => section.title === "Productivity");
  assert.ok(
    productivity.items.some((item) => item.label === "ChatGPT"),
    "Renamed overlay label should appear"
  );
  assert.ok(
    !productivity.items.some((item) => item.label === "Chat GPT"),
    "Original label should be hidden"
  );
}

// bm hide/unhide toggles visibility without losing overlay data
{
  let overlay = freshOverlay();
  overlay = addBookmark(overlay, {
    label: "Daily",
    url: "https://daily.dev",
    group: "Downtime",
  });
  overlay = hideBookmark(overlay, "Daily");
  let merged = mergeWithOverlay(BASELINE, overlay);
  const downtime = merged.sections.find((section) => section.title === "Downtime");
  assert.ok(
    !downtime.items.some((item) => item.label === "Daily"),
    "Hidden overlay bookmark should not render"
  );
  overlay = unhideBookmark(overlay, "daily");
  merged = mergeWithOverlay(BASELINE, overlay);
  const downtimeAfter = merged.sections.find((section) => section.title === "Downtime");
  assert.ok(
    downtimeAfter.items.some((item) => item.label === "Daily"),
    "Unhidden bookmark should return"
  );
}

// bm sort apply/reset should capture DOM order metadata
{
  let overlay = freshOverlay();
  const snapshot = {
    sections: [
      { title: "Productivity", items: [{ label: "Linear" }, { label: "Chat GPT" }] },
      { title: "Downtime", items: [{ label: "Reddit" }, { label: "Hacker News" }] },
    ],
  };
  overlay = applyOrder(overlay, snapshot);
  assert.deepStrictEqual(
    overlay.order.groups,
    ["Productivity", "Downtime"],
    "applyOrder should record group order"
  );
  assert.deepStrictEqual(
    overlay.order.labels["Productivity"],
    ["Linear", "Chat GPT"],
    "applyOrder should snapshot item order"
  );
  overlay = resetOrder(overlay);
  assert.deepStrictEqual(overlay.order.groups, [], "resetOrder should clear stored group order");
}

// bm sort / groups sort should store view preferences
{
  let overlay = freshOverlay();
  overlay = setSort(overlay, { mode: "alpha" });
  overlay = setSort(overlay, { group: "Downtime", mode: "smart" });
  overlay = setGroupSortMode(overlay, "alpha");
  assert.strictEqual(overlay.sort.labels.default, "alpha", "Default label sort should be recorded");
  assert.strictEqual(
    overlay.sort.labels.Downtime,
    "smart",
    "Group-specific sort should be recorded"
  );
  assert.strictEqual(overlay.sort.groups, "alpha", "Group sort mode should be recorded");
}

console.log("✓ bookmarks overlay operations passed");
