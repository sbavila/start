import { state } from "./state.js";

export function initThemeLoader() {
  if (!(state.themeLinks instanceof Map)) {
    state.themeLinks = new Map();
  }

  const layoutLink = document.querySelector('link[href$="assets/css/layout.css"]');

  document
    .querySelectorAll('link[rel="stylesheet"][data-theme]')
    .forEach((existing) => {
      const theme = existing.dataset.theme;
      if (!theme) return;
      state.themeLinks.set(theme, existing);
      existing.media = theme === state.activeTheme ? "all" : "print";
      existing.dataset.loaded = "true";
    });

  state.themes.forEach((theme) => {
    if (state.themeLinks.has(theme)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./main-themes/${theme}/style.css`;
    link.dataset.theme = theme;
    link.media = theme === state.activeTheme ? "all" : "print";
    link.setAttribute("data-managed-theme", "true");
    link.addEventListener("load", () => {
      link.dataset.loaded = "true";
      if (state.activeTheme !== theme && link.media !== "print") {
        link.media = "print";
      }
    });
    if (layoutLink?.parentNode) {
      layoutLink.parentNode.insertBefore(link, layoutLink);
    } else {
      document.head.appendChild(link);
    }
    state.themeLinks.set(theme, link);
  });

  applyTheme(state.activeTheme, { skipPersist: true });
}

export function changeCSS(theme) {
  applyTheme(theme);
}

function applyTheme(theme, { skipPersist = false } = {}) {
  if (!state.themes.includes(theme)) return;
  if (!(state.themeLinks instanceof Map) || !state.themeLinks.size) {
    initThemeLoader();
  }

  const next = state.themeLinks.get(theme);
  if (!next) return;
  const current = state.themeLinks.get(state.activeTheme);

  const activate = () => {
    if (current && current !== next) {
      current.media = "print";
      current.dataset.active = "false";
    }
    next.media = "all";
    next.dataset.active = "true";
    state.activeTheme = theme;
    if (!skipPersist) {
      try {
        localStorage.setItem("selected-theme", theme);
      } catch {
        // ignore storage failures
      }
    }
  };

  if (next.dataset.loaded === "true" || next.sheet) {
    activate();
  } else {
    next.addEventListener("load", activate, { once: true });
    next.media = "all";
  }
}
