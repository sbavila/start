// assets/js/timers.js
import { state } from "./state.js";
import { clearCommandLine } from "./search.js";

const STORAGE_KEY = "timers.v1";
const timers = new Map();           // id -> timer
let tick = null;

export function initTimersUI() {
  if (document.getElementById("timer-stack")) return;
  const stack = document.createElement("div");
  stack.id = "timer-stack";
  stack.className = "timer-stack";
  document.body.appendChild(stack);
}

export function restoreTimers() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    raw.forEach(t => {
      if (t.endAt > Date.now()) addTimerToUI(t);
    });
    startTick();
  } catch {}
}

export function createTimer(durationMs, label = "Timer") {
  if (!durationMs || durationMs < 500) return null;
  const t = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
    label,
    createdAt: Date.now(),
    duration: durationMs,
    endAt: Date.now() + durationMs
  };
  addTimerToUI(t);
  persist();
  startTick();
  requestNotificationPermission();
  return t;
}

export function cancelTimer(id) {
  const tile = document.getElementById("timer-" + id);
  if (tile) tile.remove();
  timers.delete(id);
  persist();
}

export function cancelAllTimers() {
  [...timers.keys()].forEach(cancelTimer);
}

export function listTimers() {
  return [...timers.values()].sort((a, b) => a.endAt - b.endAt);
}

function addTimerToUI(t) {
  timers.set(t.id, t);
  let tile = document.getElementById("timer-" + t.id);
  if (!tile) {
    tile = document.createElement("div");
    tile.className = "timer-tile";
    tile.id = "timer-" + t.id;
    tile.innerHTML = `
      <div class="timer-row">
        <div class="timer-label"></div>
        <div class="timer-remaining"></div>
      </div>
      <div class="timer-progress"><i></i></div>
      <div class="timer-actions">
        <button class="timer-stop" aria-label="Cancel timer">Cancel</button>
      </div>
    `;
    document.getElementById("timer-stack").appendChild(tile);
    tile.querySelector(".timer-stop").addEventListener("click", () => cancelTimer(t.id));
  }
  tile.querySelector(".timer-label").textContent = t.label;
  updateTile(tile, t);
}

function startTick() {
  if (tick) return;
  tick = setInterval(() => {
    const now = Date.now();
    for (const t of timers.values()) {
      const tile = document.getElementById("timer-" + t.id);
      if (!tile) continue;
      const remaining = Math.max(0, t.endAt - now);
      updateTile(tile, t, remaining);
      if (remaining <= 0) finishTimer(t);
    }
  }, 250);
}

function updateTile(tile, t, remaining = t.endAt - Date.now()) {
  const remEl = tile.querySelector(".timer-remaining");
  remEl.textContent = format(remaining);
  const pct = Math.min(100, Math.max(0, ((t.duration - remaining) / t.duration) * 100));
  tile.querySelector(".timer-progress > i").style.width = pct + "%";
}

function finishTimer(t) {
  // mark done
  const tile = document.getElementById("timer-" + t.id);
  if (tile) {
    tile.classList.add("timer-done");
    const bar = tile.querySelector(".timer-progress > i");
    if (bar) bar.classList.add("done");
  }
  notify(`Timer done`, t.label);
  beep();
  timers.delete(t.id);
  persist();
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...timers.values()].map(t => ({
      id: t.id, label: t.label, createdAt: t.createdAt, duration: t.duration, endAt: t.endAt
    })))
  );
}

// ---- utilities ----
export function parseDuration(s) {
  if (!s) return 0;
  s = s.trim().toLowerCase();
  // hh:mm:ss or mm:ss
  const hhmmss = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmmss) {
    const h = hhmmss[3] ? parseInt(hhmmss[1], 10) : 0;
    const m = parseInt(hhmmss[hhmmss[3] ? 2 : 1], 10);
    const sec = parseInt(hhmmss[3] ? hhmmss[3] : hhmmss[2], 10);
    return ((h * 60 + m) * 60 + sec) * 1000;
  }
  // 1h30m10s style
  let total = 0, matched = false;
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let m;
  while ((m = re.exec(s))) {
    matched = true;
    const val = parseFloat(m[1]);
    total += m[2] === "h" ? val * 3600000
         :  m[2] === "m" ? val * 60000
         :  m[2] === "s" ? val * 1000
         :  val; // ms
  }
  if (matched) return Math.round(total);
  // plain number => seconds
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 1000;
  return 0;
}

if (typeof window !== "undefined") {
  console.assert(
    parseDuration("1:02:03") === 3723000,
    "parseDuration should parse hh:mm:ss correctly"
  );
}

function format(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (neg ? "-" : "") + (h ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    o.start();
    setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2); o.stop(ctx.currentTime + 0.25); }, 250);
  } catch {}
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(()=>{});
  }
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    try { new Notification(title, { body }); return; } catch {}
  }
  // fallback: a subtle modal-ish toast
  const t = document.createElement("div");
  t.className = "timer-toast";
  t.textContent = `${title}: ${body}`;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add("show"), 10);
  setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(), 400); }, 3000);
}
