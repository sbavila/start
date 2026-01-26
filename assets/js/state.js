// Single shared state object. Everyone imports from here.
const THEMES = ["magenta", "light", "cyan", "amber", "lime"];
const BASE_TIMEZONES = ["Europe/London", "Europe/Berlin"];
const LOCAL_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
})();
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
  timezones: LOCAL_TIMEZONE && !BASE_TIMEZONES.includes(LOCAL_TIMEZONE)
    ? [LOCAL_TIMEZONE, ...BASE_TIMEZONES]
    : [...BASE_TIMEZONES],
  BOOKMARK_ALIASES: Object.create(null),
};

export function ensureLocalTimezone() {
  if (!LOCAL_TIMEZONE) return;
  if (!state.timezones.includes(LOCAL_TIMEZONE)) {
    state.timezones.unshift(LOCAL_TIMEZONE);
  }
}

Object.defineProperty(state, "LINK_ALIASES", {
  get() {
    return state.BOOKMARK_ALIASES;
  },
  set(value) {
    state.BOOKMARK_ALIASES = value || Object.create(null);
  },
});
