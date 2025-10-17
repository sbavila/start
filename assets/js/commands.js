import { state } from "./state.js";
import { changeCSS } from "./theme.js";
import { routeSearch, clearCommandLine } from "./search.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { setProfile } from "./profiles.js";
import { createTimer, cancelTimer, cancelAllTimers, listTimers, parseDuration } from "./timers.js";

// Modal helpers
const esc = (s)=> (s||"").replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const pre = (t)=> `<pre class="modal-pre">${esc(t)}</pre>`;
const HELP_OVERVIEW = pre([
  "Commands:",
  "  help [topic]          Show this list or topic-specific help",
  "  ls [profiles|tz|groups|bookmarks]",
  "  bm ls [filter]        List bookmarks (filter optional)",
  "  pwd | cd <profile>    Show or change profile",
  "  theme <name>          Switch theme",
  "  date                  Show today’s date",
  "  tz ls | tz add <IANA> | tz rm <IANA>",
  "  note <text> | cat notes | rm notes",
  "  timer <dur> [label] | timer ls | timer rm <id|all>",
  "",
  "Shortcuts:",
  "  g <q> | ddg <q> | yt <q> | r <sub> | hn",
  "",
  "Tip: Anything else searches DuckDuckGo or opens URLs directly."
].join("\n"));
function showModal(title, html) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "presentation");

  const modalId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  const titleId = `${modalId}-title`;

  overlay.innerHTML = `
    <div class="modal-window" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <button class="modal-close" aria-label="Close">×</button>
      <h3 class="modal-title" id="${titleId}">${esc(title)}</h3>
      <div class="modal-body">${html}</div>
      <div class="modal-actions"><button class="modal-ok">OK</button></div>
    </div>`;

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.appendChild(overlay);

  const dialog = overlay.querySelector(".modal-window");
  const closeBtn = overlay.querySelector(".modal-close");
  const okBtn = overlay.querySelector(".modal-ok");

  const focusables = Array.from(
    overlay.querySelectorAll(
      'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute("disabled"));

  const restoreFocus = () => {
    if (previouslyFocused) {
      previouslyFocused.focus();
      return;
    }
    document.getElementById("search_box")?.focus();
  };

  const close = () => {
    overlay.remove();
    clearCommandLine();
    window.removeEventListener("keydown", onKeyDown);
    restoreFocus();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab" && focusables.length) {
      const currentIndex = focusables.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      if (currentIndex === -1) {
        nextIndex = event.shiftKey ? focusables.length - 1 : 0;
      } else if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
      }
      event.preventDefault();
      focusables[nextIndex].focus();
    }
  };

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      event.preventDefault();
      close();
    }
  });
  closeBtn.addEventListener("click", close);
  okBtn.addEventListener("click", close);
  window.addEventListener("keydown", onKeyDown);

  dialog.focus();
  (focusables[0] || okBtn).focus();
}

// Commands
export function runCommand(line) {
  const raw = line.slice(1).trim();
  if (!raw) { clearCommandLine(); return; }
  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rest = parts.slice(1);
  const arg  = rest.join(" ");

  switch (cmd) {
   // assets/js/commands.js (inside runCommand)
case "help": {
  const topic = (rest[0]||"").toLowerCase();
  if (!topic) { showModal("Help", HELP_OVERVIEW); break; }
  if (topic === "bm" || topic === "bookmarks") {
    showModal("Help — bm", pre([
      "bm ls [filter]",
      "  List bookmarks known to this page (baseline + overlay once enabled).",
      "  Example: bm ls mtx",
      "",
      "More bm commands (add/rm/mv/ren/sort) arrive next; for now, list + filter is live."
    ].join("\n"))); break;
  }
  // add other topics over time: help sync, help notes, help offline...
  showModal("Help", `<p>Unknown topic. Showing general help instead.</p>${HELP_OVERVIEW}`);
  break;
}


case "ls":
  if (!rest.length || rest[0] === "profiles")      showProfiles();
  else if (rest[0] === "tz" || rest[0] === "time") tzCmd("ls");
  else if (rest[0] === "links")                    showGroups();
  else if (rest[0] === "groups")                   showGroups();
  else if (rest[0] === "bookmarks")                showBookmarks(rest.slice(1).join(" "));
  else showModal("ls", "Try <code>ls</code> | <code>ls tz</code> | <code>ls groups</code> | <code>ls bookmarks</code>");
  break;

// NEW: primary entry point for bookmarks
case "bm": {
  const sub = (rest[0] || "").toLowerCase();
  const arg = rest.slice(1).join(" ");
  if (sub === "ls" || sub === "list" || !sub) {
    showBookmarks(arg);
  } else {
    showModal("bm", "Implemented now: <code>bm ls [filter]</code>. More bm commands (add/rm/mv/ren/sort) arrive in the next pass.");
  }
  break;
}

  case "labels":
  showModal("Bookmarks", pre("Heads‑up: <labels> is deprecated.\nUse: bm ls [filter]\n\nListing now…"));
  showBookmarks(rest.join(" "));
  break;

    case "pwd": showModal("Current profile", pre(state.ACTIVE_PROFILE)); break;

    case "cd": {
      const target = (rest[0]||"").toLowerCase();
      if (!target) { showModal("cd", "Usage: <code>cd &lt;profile&gt;</code> or <code>cd -</code>"); break; }
      if (target === "-") {
        if (!state.LAST_PROFILE) { showModal("cd", "No previous profile."); break; }
        const cur = state.ACTIVE_PROFILE; setProfile(state.LAST_PROFILE); state.LAST_PROFILE = cur; break;
      }
      const match = state.PROFILES.find(p => p.id === target);
      if (!match) { showModal("cd", `Unknown profile: <b>${esc(target)}</b>`); break; }
      state.LAST_PROFILE = state.ACTIVE_PROFILE; setProfile(match.id); break;
    }

    case "theme":
      if (!rest.length) { showModal("theme", "Usage: <code>theme &lt;name&gt;</code>"); break; }
      if (!state.themes.includes(rest[0])) { showModal("theme", `Unknown theme: <b>${esc(rest[0])}</b>`); break; }
      changeCSS(rest[0]); break;

    case "date": showDate(); break;
    case "tz":   tzCmd(rest[0], rest.slice(1).join(" ")); break;

    case "note":
      { const txt = document.getElementById("scratch");
        if (!txt) break;
        if (!arg) { showModal("note", "Usage: <code>note &lt;text&gt;</code>"); break; }
        txt.value += (txt.value ? "\n" : "") + arg;
        localStorage.setItem("scratchpad", txt.value); }
      break;

    case "cat":
      if (rest[0] === "notes") {
        const txt = document.getElementById("scratch");
        showModal("Notes", pre(txt?.value || "(empty)"));
      } else showModal("cat", "Usage: <code>cat notes</code>");
      break;

    case "rm":
    case "clear":
      if (rest.join(" ") === "notes") {
        const txt = document.getElementById("scratch");
        if (txt) { txt.value = ""; localStorage.removeItem("scratchpad"); }
      } else showModal(cmd, "Usage: <code>rm notes</code>");
      break;

    case "g": case "ddg": case "yt": case "r": case "hn":
      routeSearch(">" + [cmd, ...rest].join(" "), runCommand); // reuse routing
      break;

    case "timer": {
      const sub = (rest[0] || "").toLowerCase();
      if (!sub) {
        showModal(
          "timer",
          "Usage: <code>timer &lt;dur&gt; [label]</code> · <code>timer ls</code> · <code>timer rm &lt;id|all&gt;</code>"
        );
        break;
      }

      if (sub === "ls") {
        const rows = listTimers().map(
          (t) => `${t.id.slice(-6)}  ${t.label}  ends ${new Date(t.endAt).toLocaleTimeString()}`
        );
        showModal("Timers", pre(rows.join("\n") || "(none)"));
        break;
      }

      if (sub === "rm") {
        const target = rest[1];
        if (target === "all") {
          cancelAllTimers();
        } else if (target) {
          cancelTimer(findTimerId(target));
        } else {
          showModal("timer rm", "Usage: <code>timer rm &lt;id|all&gt;</code>");
        }
        break;
      }

      // else assume duration + optional label
      const durMs = parseDuration(sub);
      const label = rest.slice(1).join(" ") || "Timer";
      if (!durMs) {
        showModal(
          "timer",
          "Couldn’t parse duration. Try <code>10m</code>, <code>1h30m</code>, <code>15:00</code>…"
        );
        break;
      }

      const t = createTimer(durMs, label);
      if (t) {
        showModal(
          "Timer started",
          pre(`${t.label}\nEnds at: ${new Date(t.endAt).toLocaleTimeString()}\nID: ${t.id.slice(-6)}`)
        );
      }
      break;
    }

    default:
      showModal("Unknown command", `No such command: <b>${esc(cmd)}</b>. Try <code>help</code>.`);
  }

  clearCommandLine(); // always clear after command
}

function findTimerId(fragmentOrId) {
  const frag = fragmentOrId.toLowerCase();
  const all = listTimers();
  const exact = all.find((t) => t.id === fragmentOrId);
  if (exact) return exact.id;
  const partial = all.find((t) => t.id.endsWith(frag));
  return partial ? partial.id : fragmentOrId; // try raw
}

function showProfiles() {
  const lines = state.PROFILES.map(p => `${p.id} — ${p.label}${p.id===state.ACTIVE_PROFILE ? "  (current)" : ""}`);
  showModal("Profiles", pre(lines.join("\n")));
}

// Links are now called Groups - 
function showGroups() {
  const groups = [...document.querySelectorAll("#links section h3")].map((heading) =>
    heading.textContent.trim()
  );
  showModal("Groups", pre(groups.map((title, index) => `${index + 1}. ${title}`).join("\n") || "(none)"));
}
// NEW: showBookmarks replaces showLabels
function showBookmarks(filter = "") {
  const entries = Object.entries(state.BOOKMARK_ALIASES).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const query = filter.trim().toLowerCase();
  const list = query
    ? entries.filter(([alias]) => alias.includes(query))
    : entries;
  const lines = list.length
    ? list.map(([alias, url]) => `${alias}  ->  ${url}`).join("\n")
    : "(no bookmarks)";
  showModal("Bookmarks", pre(lines));
}

function showDate() {
  const now = new Date();
  const out = state.timezones.map(tz => {
    try {
      const t = new Intl.DateTimeFormat("en-GB",{ timeZone: tz, hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
      return `${tz}: ${t}`;
    } catch { return `${tz}: [invalid tz]`; }
  });
  showModal("Time", pre(out.join("\n")));
}
function tzCmd(sub, zone) {
  switch ((sub||"").toLowerCase()) {
    case "add":
      if (!zone) return showModal("tz add", "Usage: <code>tz add &lt;IANA_tz&gt;</code>");
      if (!state.timezones.includes(zone)) state.timezones.push(zone);
      rerenderClocks(); break;
    case "rm":
    case "remove":
      if (!zone) return showModal("tz rm", "Usage: <code>tz rm &lt;IANA_tz&gt;</code>");
      { const i = state.timezones.indexOf(zone); if (i >= 0) state.timezones.splice(i,1); }
      rerenderClocks(); break;
    case "ls":
    case "list":
      showModal("Timezones", pre(state.timezones.join("\n") || "(none)")); break;
    default:
      showModal("tz", "Usage: <code>tz add &lt;IANA_tz&gt;</code> · <code>tz rm &lt;IANA_tz&gt;</code> · <code>tz ls</code>");
  }
}
function rerenderClocks() {
  const clocksEl = document.getElementById("clocks");
  if (clocksEl) { renderClocks(clocksEl); startClockTicker(clocksEl); }
}

/* Autocomplete */
export function initCommandHints() {
  const input = document.getElementById("search_box");
  const hints = document.getElementById("cmd-hints");
  if (!input || !hints) return;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "cmd-hints");
  input.setAttribute("aria-expanded", "false");

  let items = [];
  let sel = -1;

  const hintId = (index) => `cmd-hint-${index}`;

  const updateActiveDescendant = () => {
    if (sel >= 0 && hints.children[sel]) {
      input.setAttribute("aria-activedescendant", hints.children[sel].id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const hide = () => {
    hints.style.display = "none";
    hints.setAttribute("aria-hidden", "true");
    input.setAttribute("aria-expanded", "false");
    sel = -1;
    items = [];
    hints.innerHTML = "";
    updateActiveDescendant();
  };

  const show = () => {
    hints.style.display = items.length ? "block" : "none";
    hints.setAttribute("aria-hidden", items.length ? "false" : "true");
    input.setAttribute("aria-expanded", items.length ? "true" : "false");
    updateActiveDescendant();
  };

  const render = () => {
    hints.innerHTML = items
      .map(
        (it, index) =>
          `<div id="${hintId(index)}" class="hint${index === sel ? " active" : ""}" role="option" aria-selected="${index === sel}">${esc(
            it.label
          )}</div>`
      )
      .join("");
    updateActiveDescendant();
  };

  const move = (delta) => {
    if (!items.length) return;
    sel = (sel + delta + items.length) % items.length;
    render();
  };

  const apply = (selected) => {
    const choice = selected ?? items[sel];
    if (!choice) return;
    input.value = ">" + choice.replace;
    if (!choice.replace.endsWith(" ")) {
      runCommand(input.value);
      hide();
      return;
    }
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    show();
  };

  const basePool = [
    "help",
    "ls ",
    "ls groups",
    "ls links",
    "ls bookmarks",
    "pwd",
    "cd ",
    "cd -",
    "bm ",
    "bm ls ",
    "theme ",
    "date",
    "tz ",
    "tz ls",
    "tz add ",
    "tz rm ",
    "note ",
    "cat notes",
    "rm notes",
    "g ",
    "ddg ",
    "yt ",
    "r ",
    "hn ",
  ];

  const baseSuggestions = (token) => {
    const norm = token.toLowerCase();
    return basePool
      .filter((entry) => entry.toLowerCase().startsWith(norm))
      .map((entry) => ({ label: entry, replace: entry }));
  };

  const suggestionsFor = (token) => {
    const [cmd, ...rest] = token.trim().split(/\s+/);
    const arg = rest.join(" ");
    if (!cmd) return baseSuggestions("");

    const out = [];
    switch (cmd) {
      case "cd": {
        const prefix = arg.toLowerCase();
        state.PROFILES.forEach((profile) => {
          if (!prefix || profile.id.startsWith(prefix)) {
            out.push({ label: `cd ${profile.id}`, replace: `cd ${profile.id}` });
          }
        });
        out.push({ label: "cd -", replace: "cd -" });
        break;
      }
      case "theme":
        state.themes.forEach((theme) => {
          if (!arg || theme.startsWith(arg)) {
            out.push({ label: `theme ${theme}`, replace: `theme ${theme}` });
          }
        });
        break;
      case "ls":
        ["profiles", "tz", "groups", "links", "bookmarks"].forEach((section) => {
          if (!arg || section.startsWith(arg)) {
            out.push({ label: `ls ${section}`, replace: `ls ${section}` });
          }
        });
        break;
      case "tz":
        ["ls", "add ", "rm "]
          .filter((keyword) => !arg || keyword.startsWith(arg))
          .forEach((keyword) => out.push({ label: `tz ${keyword}`, replace: `tz ${keyword}` }));
        if (arg.startsWith("add ")) {
          const search = arg.slice(4).toLowerCase();
          ["Europe/London", "UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo"].forEach((zone) => {
            if (!search || zone.toLowerCase().includes(search)) {
              out.push({ label: `tz add ${zone}`, replace: `tz add ${zone}` });
            }
          });
        }
        break;
      case "bm":
        if (!arg || "ls".startsWith(arg)) {
          out.push({ label: "bm ls ", replace: "bm ls " });
        }
        break;
      default:
        return baseSuggestions(token);
    }
    return out.length ? out : baseSuggestions(token);
  };

  input.addEventListener("input", () => {
    const value = input.value.trimStart();
    if (!value.startsWith(">")) {
      hide();
      return;
    }
    const token = value.slice(1);
    items = suggestionsFor(token);
    sel = items.length ? 0 : -1;
    render();
    show();
  });
  input.addEventListener("keydown", (e) => {
    const active = hints.style.display === "block";
    if (e.key === "ArrowDown" && active) { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp"   && active) { e.preventDefault(); move(-1); }
    else if (e.key === "Tab"       && active) { e.preventDefault(); apply(); }
    else if (e.key === "Enter"     && active && sel >= 0) { e.preventDefault(); apply(); }
    else if (e.key === "Escape"    && active) { e.preventDefault(); hide(); clearCommandLine(); }
  });
  hints.addEventListener("mousedown", (e) => {
    const el = e.target.closest(".hint"); if (!el) return;
    const idx = [...hints.children].indexOf(el);
    sel = idx; apply();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hints.style.display !== "block") { clearCommandLine(); }
  });
  input.addEventListener("blur", () => setTimeout(hide, 150));

  hide();
}

export { showGroups as showLinkSections };
