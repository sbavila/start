import { state } from "./state.js";
import { addBookmark, loadOverlay, removeBookmark, saveOverlay } from "./bookmarks.js";
import { refreshLinks } from "./links.js";

function normalizeGroupTitle(title) {
  const raw = typeof title === "string" ? title.trim() : "";
  if (!raw) return "";
  return raw.replace(/^\/\/+\s*/, "").trim();
}

function readGroupsFromDOM() {
  return Array.from(document.querySelectorAll("#links section h3"))
    .map((heading) => normalizeGroupTitle(heading.textContent))
    .filter(Boolean);
}

function readBookmarksFromDOM() {
  const entries = [];
  document.querySelectorAll("#links section").forEach((section) => {
    const title = normalizeGroupTitle(section.querySelector("h3")?.textContent || "");
    section.querySelectorAll("a").forEach((anchor) => {
      const label = (anchor.textContent || "").trim();
      if (!label) return;
      entries.push({
        label,
        url: anchor.getAttribute("href") || "",
        group: title || "Bookmarks",
      });
    });
  });
  return entries;
}

function setStatus(statusEl, message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function updateSelect(selectEl, entries, emptyLabel) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  if (!entries.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = emptyLabel;
    selectEl.appendChild(opt);
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  entries.forEach((entry) => {
    const opt = document.createElement("option");
    opt.value = entry.label;
    opt.textContent = `${entry.label} — ${entry.group}`;
    selectEl.appendChild(opt);
  });
}

function updateDatalist(listEl, groups) {
  if (!listEl) return;
  listEl.innerHTML = "";
  groups.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group;
    listEl.appendChild(opt);
  });
}

export function initBookmarkManager({ linksEl, clocksEl } = {}) {
  const manager = document.getElementById("bookmark-manager");
  if (!manager) return;

  const addForm = manager.querySelector("#bookmark-add-form");
  const moveForm = manager.querySelector("#bookmark-move-form");
  const removeForm = manager.querySelector("#bookmark-remove-form");
  const groupOptions = manager.querySelector("#group-options");
  const statusEl = manager.querySelector("#bookmark-status");

  const addLabelInput = manager.querySelector("#bookmark-label");
  const addUrlInput = manager.querySelector("#bookmark-url");
  const addGroupInput = manager.querySelector("#bookmark-group");

  const moveSelect = manager.querySelector("#bookmark-move-select");
  const moveGroupInput = manager.querySelector("#bookmark-move-group");
  const removeSelect = manager.querySelector("#bookmark-remove-select");

  let currentBookmarks = [];

  const syncOptions = () => {
    const groups = readGroupsFromDOM();
    currentBookmarks = readBookmarksFromDOM();
    updateDatalist(groupOptions, groups);
    updateSelect(moveSelect, currentBookmarks, "No bookmarks available");
    updateSelect(removeSelect, currentBookmarks, "No bookmarks available");
  };

  const applyOverlay = async (nextOverlay) => {
    saveOverlay(state.ACTIVE_PROFILE, nextOverlay);
    await refreshLinks(linksEl, clocksEl);
    syncOptions();
  };

  addForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = addLabelInput?.value.trim() || "";
    const url = addUrlInput?.value.trim() || "";
    const group = addGroupInput?.value.trim() || "";

    if (!label || !url) {
      setStatus(statusEl, "Add a label and URL first.");
      return;
    }

    const overlay = loadOverlay(state.ACTIVE_PROFILE);
    const nextOverlay = addBookmark(overlay, { label, url, group });
    await applyOverlay(nextOverlay);

    if (addLabelInput) addLabelInput.value = "";
    if (addUrlInput) addUrlInput.value = "";
    if (addGroupInput) addGroupInput.value = "";
    setStatus(statusEl, `Added “${label}”.`);
  });

  moveForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = moveSelect?.value || "";
    const group = moveGroupInput?.value.trim() || "";

    if (!label) {
      setStatus(statusEl, "Choose a bookmark to move.");
      return;
    }
    if (!group) {
      setStatus(statusEl, "Enter the destination group.");
      return;
    }

    const entry = currentBookmarks.find((bookmark) => bookmark.label === label);
    if (!entry) {
      setStatus(statusEl, "That bookmark is no longer available.");
      return;
    }

    const overlay = loadOverlay(state.ACTIVE_PROFILE);
    const nextOverlay = addBookmark(overlay, { label: entry.label, url: entry.url, group });
    await applyOverlay(nextOverlay);

    if (moveGroupInput) moveGroupInput.value = "";
    setStatus(statusEl, `Moved “${label}” to ${group}.`);
  });

  removeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = removeSelect?.value || "";

    if (!label) {
      setStatus(statusEl, "Choose a bookmark to remove.");
      return;
    }

    const overlay = loadOverlay(state.ACTIVE_PROFILE);
    const nextOverlay = removeBookmark(overlay, label);
    await applyOverlay(nextOverlay);
    setStatus(statusEl, `Removed “${label}”.`);
  });

  syncOptions();
  document.addEventListener("links:updated", syncOptions);
}
