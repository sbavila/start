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
  PROFILES: [],
  ACTIVE_PROFILE: null,
  LAST_PROFILE: null,        // for `cd -`
  timezones: ["Europe/London", "Europe/Berlin"],
  LINK_ALIASES: {},          // label -> URL
};
