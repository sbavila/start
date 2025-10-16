import { state } from "./state.js";
import { changeCSS } from "./theme.js";

export async function loadProfiles() {
  try {
    const res = await fetch("./profiles.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.PROFILES = Array.isArray(data.profiles)
      ? data.profiles.map(p => ({...p, id: String(p.id||"").toLowerCase(), label: p.label || String(p.id||"").toLowerCase()}))
      : [];
  } catch {
    state.PROFILES = [{ id: "default", label: "Default", default: true }];
  }
}

export function pickInitialProfile() {
  const byId = (id) => state.PROFILES.find(p => p.id === id);
  const params = new URLSearchParams(location.search);
  const qp = (params.get("profile") || "").toLowerCase();
  const stored = (localStorage.getItem("profile") || "").toLowerCase();
  if (qp && byId(qp)) state.ACTIVE_PROFILE = qp;
  else if (stored && byId(stored)) state.ACTIVE_PROFILE = stored;
  else state.ACTIVE_PROFILE = (state.PROFILES.find(p => p.default) || state.PROFILES[0]).id;
  localStorage.setItem("profile", state.ACTIVE_PROFILE);
}

export function setProfile(profileId) {
  localStorage.setItem("profile", profileId);
  const params = new URLSearchParams(location.search);
  params.set("profile", profileId);
  location.search = params.toString();
}

export function renderProfileMenu(menuEl) {
  if (!menuEl) return;
  [...menuEl.querySelectorAll('a[data-profile]')].forEach(a => a.parentElement.remove());
  const anchor = menuEl.querySelector(".menu-heading") || menuEl.lastElementChild;
  state.PROFILES.forEach(p => {
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.href = "#"; a.setAttribute("data-profile", p.id);
    a.textContent = p.label + (p.id === state.ACTIVE_PROFILE ? " (current)" : "");
    if (p.id === state.ACTIVE_PROFILE) a.classList.add("profile-current");
    li.appendChild(a); anchor.parentNode.insertBefore(li, anchor.nextSibling);
  });
}

export function updateProfileBadge(badgeEl) {
  if (!badgeEl) return;
  const p = state.PROFILES.find(x => x.id === state.ACTIVE_PROFILE);
  badgeEl.querySelector("span").textContent = p ? `${p.label} (${p.id})` : state.ACTIVE_PROFILE;
}

export function applyProfileDefaults() {
  const p = state.PROFILES.find(x => x.id === state.ACTIVE_PROFILE);
  if (p?.theme) changeCSS(p.theme);
  if (Array.isArray(p?.timezones) && p.timezones.length) {
    state.timezones.splice(0, state.timezones.length, ...p.timezones);
  }
}
