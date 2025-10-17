import { state } from "./state.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { changeCSS } from "./theme.js";
import { loadOverlay, mergeWithOverlay } from "./bookmarks.js";

export async function refreshLinks(linksEl, clocksEl) {
  // Profile defaults first (theme/tz)
  // (applied upstream via applyProfileDefaults in profiles.js)

  const file = `./links-${state.ACTIVE_PROFILE.toLowerCase()}.json`;
  let data = null;
  try {
    data = await getJSON(file);
  } catch {
    data = await getJSON("./links-default.json");
  }
  applyFileMeta(data);
  const overlay = loadOverlay(state.ACTIVE_PROFILE);
  const merged = mergeWithOverlay(data, overlay);
  renderGroups(linksEl, merged);
  buildBookmarkAliases(linksEl);

  // Update clocks after possible tz overrides from link file
  if (clocksEl) { renderClocks(clocksEl); startClockTicker(clocksEl); }
}

function applyFileMeta(data) {
  if (data.title) document.title = data.title;
  if (data.theme) changeCSS(data.theme); // link file wins
  if (Array.isArray(data.timezones) && data.timezones.length) {
    state.timezones.splice(0, state.timezones.length, ...data.timezones);
  }
}

function renderGroups(container, data) {
  if (!container) return;
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const frag = document.createDocumentFragment();

  for (const s of sections) {
    const sec = document.createElement("section");
    const h3  = document.createElement("h3");
    const raw = s.title || "Links";
    h3.textContent = raw.trim().startsWith("//") ? raw.trim() : `// ${raw.trim()}`;

    const ul  = document.createElement("ul");
    (Array.isArray(s.items) ? s.items : []).forEach((bookmark) => {
      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.href = bookmark.url || "#";
      a.textContent = bookmark.label || bookmark.url || "bookmark";
      li.appendChild(a);
      ul.appendChild(li);
    });

    sec.appendChild(h3); sec.appendChild(ul); frag.appendChild(sec);
  }

  container.innerHTML = "";
  container.appendChild(frag);
}

export function buildBookmarkAliases(linksEl) {
  if (!linksEl) {
    state.BOOKMARK_ALIASES = Object.create(null);
    return;
  }
  const aliases = Object.create(null);
  linksEl.querySelectorAll("a").forEach((anchor) => {
    const label = (anchor.textContent || "").trim();
    if (!label || !anchor.href) return;
    const lower = label.toLowerCase();
    addAlias(aliases, lower, anchor.href);
    const compact = lower.replace(/[^a-z0-9]+/g, "").trim();
    if (compact && compact !== lower) addAlias(aliases, compact, anchor.href);
  });
  state.BOOKMARK_ALIASES = aliases;
}

function addAlias(aliases, alias, href) {
  if (!alias) return;
  if (!(alias in aliases)) aliases[alias] = href;
}

async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
