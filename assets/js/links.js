import { state } from "./state.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { changeCSS } from "./theme.js";

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
  renderLinks(linksEl, data);
  buildQuickAliases(linksEl);

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

function renderLinks(container, data) {
  if (!container) return;
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const frag = document.createDocumentFragment();

  for (const s of sections) {
    const sec = document.createElement("section");
    const h3  = document.createElement("h3");
    const raw = s.title || "Links";
    h3.textContent = raw.trim().startsWith("//") ? raw.trim() : `// ${raw.trim()}`;

    const ul  = document.createElement("ul");
    (Array.isArray(s.items) ? s.items : []).forEach(it => {
      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.href = it.url || "#"; a.textContent = it.label || it.url || "link";
      li.appendChild(a); ul.appendChild(li);
    });

    sec.appendChild(h3); sec.appendChild(ul); frag.appendChild(sec);
  }

  container.innerHTML = "";
  container.appendChild(frag);
}

export function buildQuickAliases(linksEl) {
  state.LINK_ALIASES = {};
  linksEl.querySelectorAll("a").forEach(a => {
    const label = (a.textContent || "").trim().toLowerCase();
    if (label && a.href) state.LINK_ALIASES[label] = a.href;
  });
}

async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
