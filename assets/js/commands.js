import { state } from "./state.js";
import { changeCSS } from "./theme.js";
import { routeSearch, clearCommandLine } from "./search.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { setProfile } from "./profiles.js";
import { createTimer, cancelTimer, cancelAllTimers, listTimers, parseDuration } from "./timers.js";

// Modal helpers
const esc = (s)=> (s||"").replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const pre = (t)=> `<pre class="modal-pre">${esc(t)}</pre>`;
function showModal(title, html) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-window" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <button class="modal-close" aria-label="Close">×</button>
      <h3 class="modal-title">${esc(title)}</h3>
      <div class="modal-body">${html}</div>
      <div class="modal-actions"><button class="modal-ok">OK</button></div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); clearCommandLine(); document.getElementById("search_box")?.focus(); };
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector(".modal-ok").addEventListener("click", close);
  const onEsc = (e)=>{ if (e.key === "Escape") { e.preventDefault(); close(); window.removeEventListener("keydown", onEsc); } };
  window.addEventListener("keydown", onEsc);
  overlay.querySelector(".modal-ok").focus();
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
  if (!topic) { /* (existing overview from above) */ break; }
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
  showModal("Help", "Unknown topic. Try: <code>help</code> or <code>help bm</code>.");
  break;
}


case "ls":
  if (!rest.length || rest[0] === "profiles")      showProfiles();
  else if (rest[0] === "tz" || rest[0] === "time") tzCmd("ls");
  else if (rest[0] === "links")                    showLinkSections();
  else if (rest[0] === "bookmarks")                showBookmarks(rest.slice(1).join(" "));
  else showModal("ls", "Try <code>ls</code> | <code>ls tz</code> | <code>ls links</code> | <code>ls bookmarks</code>");
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
      showModal("timer", "Usage: <code>timer &lt;dur&gt; [label]</code> · <code>timer ls</code> · <code>timer rm &lt;id|all&gt;</code>");
      break;
      }

      if (sub === "ls") {
      const rows = listTimers().map(t => `${t.id.slice(-6)}  ${t.label}  ends ${new Date(t.endAt).toLocaleTimeString()}`);
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
      showModal("timer", "Couldn’t parse duration. Try <code>10m</code>, <code>1h30m</code>, <code>15:00</code>…");
      break;
      }

      const t = createTimer(durMs, label);
      if (t) {
      showModal("Timer started", pre(`${t.label}\nEnds at: ${new Date(t.endAt).toLocaleTimeString()}\nID: ${t.id.slice(-6)}`));
      }
      break;
    }

    function findTimerId(fragmentOrId) {
      const frag = fragmentOrId.toLowerCase();
      const all = listTimers();
      const exact = all.find(t => t.id === fragmentOrId);
      if (exact) return exact.id;
      const partial = all.find(t => t.id.endsWith(frag));
      return partial ? partial.id : fragmentOrId; // try raw
    }

    default:
      showModal("Unknown command", `No such command: <b>${esc(cmd)}</b>. Try <code>help</code>.`);
  }

  clearCommandLine(); // always clear after command
}

function showProfiles() {
  const lines = state.PROFILES.map(p => `${p.id} — ${p.label}${p.id===state.ACTIVE_PROFILE ? "  (current)" : ""}`);
  showModal("Profiles", pre(lines.join("\n")));
}

// Links are now called Groups - 
function showLinkSections() {
  const secs = [...document.querySelectorAll("#links section h3")].map(h => h.textContent.trim());
  showModal("Link Sections", pre(secs.map((t,i)=>`${i+1}. ${t}`).join("\n") || "(none)"));
}
// NEW: showBookmarks replaces showLabels
function showBookmarks(filter = "") {
  const keys = Object.keys(state.LINK_ALIASES).sort((a,b)=>a.localeCompare(b));
  const list = filter ? keys.filter(k => k.includes(filter.toLowerCase())) : keys;
  const lines = list.length
    ? list.map(k => `${k}  ->  ${state.LINK_ALIASES[k]}`).join("\n")
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

  let items = []; let sel = -1;
  const hide  = ()=>{ hints.style.display="none"; sel=-1; items=[]; hints.innerHTML=""; };
  const show  = ()=>{ hints.style.display = items.length ? "block" : "none"; };
  const render= ()=>{ hints.innerHTML = items.map((it,i)=>`<div class="hint${i===sel?' active':''}" role="option">${esc(it.label)}</div>`).join(""); };
  const move  = (d)=>{ if (!items.length) return; sel=(sel+d+items.length)%items.length; render(); };
  const apply = (selected)=>{
    const it = selected ?? items[sel]; if (!it) return;
    input.value = ">" + it.replace;
    if (!it.replace.endsWith(" ")) { runCommand(input.value); hide(); return; }
    input.focus(); input.setSelectionRange(input.value.length,input.value.length); show();
  };

  function baseSuggestions(tok){
  const first = tok.split(/\s+/)[0].toLowerCase();
  const pool = [
    "help","ls ","pwd","cd ","cd -",
    "bm ","bm ls ","ls bookmarks",
    "theme ","date","tz ","tz ls","tz add ","tz rm ",
    "note ","cat notes","rm notes",
    "g ","ddg ","yt ","r ","hn "
  ];
  return pool.filter(s => s.startsWith(first)).map(s => ({ label:s, replace:s }));
}

  function suggestionsFor(tok){
  const [cmd, ...rest] = tok.trim().split(/\s+/);
  const arg = rest.join(" ");
  const out = [];
  if (!cmd) return baseSuggestions("");

  switch (cmd) {
    case "cd":
      state.PROFILES.forEach(p => { if (!arg || p.id.startsWith(arg.toLowerCase())) out.push({label:`cd ${p.id}`, replace:`cd ${p.id}`}); });
      out.push({label:"cd -", replace:"cd -"});
      break;
    case "theme":
      state.themes.forEach(t => { if (!arg || t.startsWith(arg)) out.push({label:`theme ${t}`, replace:`theme ${t}`}); });
      break;
    case "ls":
      ["profiles","tz","links","bookmarks"].forEach(k => {
        if (!arg || k.startsWith(arg)) out.push({label:`ls ${k}`, replace:`ls ${k}`});
      });
      break;
    case "tz":
      ["ls","add ","rm "].forEach(k => { if (!arg || k.startsWith(arg)) out.push({label:`tz ${k}`, replace:`tz ${k}`}); });
      if (arg.startsWith("add ")) {
        ["Europe/London","UTC","America/New_York","Europe/Berlin","Asia/Tokyo"].forEach(z=>{
          if (z.toLowerCase().includes(arg.slice(4).toLowerCase())) out.push({label:`tz add ${z}`, replace:`tz add ${z}`});
        });
      }
      break;
    case "bm":
      // for now, only ‘ls’ is implemented; when add/rm arrive, we list them here
      if (!arg || "ls".startsWith(arg)) out.push({label:"bm ls ", replace:"bm ls "});
      break;
    default:
      return baseSuggestions(tok);
  }
  return out.length ? out : baseSuggestions(tok);
}


  input.addEventListener("input", () => {
    const v = input.value.trimStart();
    if (!v.startsWith(">")) { hide(); return; }
    const tok = v.slice(1);
    items = suggestionsFor(tok);
    sel = items.length ? 0 : -1;
    render(); show();
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
}
