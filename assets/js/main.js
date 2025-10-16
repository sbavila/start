import { state } from "./state.js";
import { initThemeLoader, changeCSS } from "./theme.js";
import { loadProfiles, pickInitialProfile, renderProfileMenu, updateProfileBadge, applyProfileDefaults, setProfile } from "./profiles.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { refreshLinks } from "./links.js";
import { runCommand, initCommandHints } from "./commands.js";
import { routeSearch, clearCommandLine, focusCommandLine, hideCmdHints } from "./search.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const themeMenu   = document.getElementById("theme-menu");
  const clocksEl    = document.getElementById("clocks");
  const linksEl     = document.getElementById("links");
  const badgeEl     = document.getElementById("profile-badge");
  const form        = document.getElementById("search-form");
  const input       = document.getElementById("search_box");

  // Themes
  initThemeLoader();
  themeMenu?.addEventListener("click", (e) => {
    const a = e.target.closest("a"); if (!a) return;
    const theme = a.getAttribute("data-theme");
    const prof  = a.getAttribute("data-profile");
    if (theme) { e.preventDefault(); changeCSS(theme); input?.focus(); }
    if (prof)  { e.preventDefault(); setProfile(prof); }
  });

  // Clocks baseline
  renderClocks(clocksEl); startClockTicker(clocksEl);

  // Input autofocus + keyboard
  input?.focus(); input?.select();
  form?.addEventListener("submit", (e) => { e.preventDefault(); routeSearch(input.value, runCommand); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input?.focus(); input?.select(); }
  });

  // Profiles + links
  await loadProfiles();
  pickInitialProfile();
  renderProfileMenu(themeMenu);
  applyProfileDefaults();       // theme/tz from profile
  updateProfileBadge(badgeEl);
  await refreshLinks(linksEl, clocksEl);

  // Command UI
  initCommandHints();

  // bfcache restore: clear & refocus
  window.addEventListener("pageshow", () => { clearCommandLine(); hideCmdHints(); focusCommandLine(); });
  window.addEventListener("visibilitychange", () => { if (!document.hidden) focusCommandLine(); });
  window.addEventListener("focus", focusCommandLine);
});
