import { state } from "./state.js";

// Global shortcuts
export const SHORTCUTS = {
  g:(q)=>`https://www.google.com/search?q=${encodeURIComponent(q)}`,
  ddg:(q)=>`https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  yt:(q)=>`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  r:(q)=>`https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  hn:(q)=>`https://hn.algolia.com/?q=${encodeURIComponent(q)}`
};

const RE_URL = /^(((http|https):\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(\/\S*)?$/;
const RE_IP  = /^(((http|https):\/\/)?((\d{1,3}\.){3}\d{1,3}|localhost))(:(\d{1,5}))?(\/\S*)?$/;
const HOST_SUFFIXES = ["local","lan"];

export function navigate(url) {
  // Clear before navigating to avoid stale bfcache input state
  const i = document.getElementById("search_box");
  if (i) i.value = "";
  window.location.href = url;
}

// Route a free-form line. For commands, pass runCommand callback.
export function routeSearch(raw, runCommand) {
  const text = raw.trim();
  if (!text) return;

  // Commands
  if (text.startsWith(">")) { runCommand(text); return; }

  // Shortcuts
  const [key, ...rest] = text.split(/\s+/);
  const q = rest.join(" ");
  if (SHORTCUTS[key]) { navigate(SHORTCUTS[key](q)); return; }

  // Label exact/unique
  const lower = text.toLowerCase();
  if (state.LINK_ALIASES[lower]) { navigate(state.LINK_ALIASES[lower]); return; }
  const match = Object.keys(state.LINK_ALIASES).filter(k => k.includes(lower));
  if (match.length === 1) { navigate(state.LINK_ALIASES[match[0]]); return; }

  // URL / IP
  if (RE_URL.test(text)) { navigate(text.startsWith("http") ? text : "https://" + text); return; }
  if (RE_IP.test(text))  { navigate(text.startsWith("http") ? text : "http://"  + text); return; }

  // .local / .lan
  const m = lower.match(/^([a-z0-9-]+)\.(\w+)$/i);
  if (m && HOST_SUFFIXES.includes((m[2]||"").toLowerCase())) { navigate("http://" + text); return; }

  // Default search
  navigate(`https://duckduckgo.com/?q=${encodeURIComponent(text)}`);
}

// bfcache / focus helpers
export function clearCommandLine() {
  const i = document.getElementById("search_box"); if (i) i.value = "";
}
export function focusCommandLine() {
  const i = document.getElementById("search_box");
  if (!i) return;
  i.placeholder = "the world at your fingertips";
  i.focus(); i.select();
}
export function hideCmdHints() {
  const hints = document.getElementById("cmd-hints");
  if (hints) { hints.style.display = "none"; hints.innerHTML = ""; }
}
