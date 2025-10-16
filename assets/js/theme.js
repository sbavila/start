import { state } from "./state.js";

export function initThemeLoader() {
  // Preload all themes; only default enabled
  state.themes.forEach((theme) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./main-themes/${theme}/style.css`;
    link.classList.add(`theme-${theme}`);
    link.disabled = theme !== state.defaultTheme;
    document.head.appendChild(link);
  });
}

export function changeCSS(theme) {
  state.themes.forEach((t) => {
    const el = document.querySelector(`.theme-${t}`);
    if (el) el.disabled = t !== theme;
  });
  localStorage.setItem("selected-theme", theme);
}
