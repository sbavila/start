// Single shared state object. Everyone imports from here.
const THEMES = ["magenta", "light", "cyan", "amber", "lime"];
let defaultTheme = THEMES[0];

try {
  const storedTheme = localStorage.getItem("selected-theme");
  if (storedTheme && THEMES.includes(storedTheme)) {
    defaultTheme = storedTheme;
  } else if (storedTheme) {
    localStorage.setItem("selected-theme", defaultTheme);
  }
} catch {
  // ignore storage access issues (private mode, etc.)
}

export const state = {
  themes: THEMES,
  defaultTheme,
  activeTheme: defaultTheme,
  themeLinks: new Map(),
  PROFILES: [],
  ACTIVE_PROFILE: null,
  LAST_PROFILE: null,        // for `cd -`
  timezones: ["Europe/London", "Europe/Berlin"],
  BOOKMARK_ALIASES: Object.create(null),
};

Object.defineProperty(state, "LINK_ALIASES", {
  get() {
    return state.BOOKMARK_ALIASES;
  },
  set(value) {
    state.BOOKMARK_ALIASES = value || Object.create(null);
  },
});
