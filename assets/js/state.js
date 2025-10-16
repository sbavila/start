// Single shared state object. Everyone imports from here.
export const state = {
  themes: ["magenta", "light", "cyan", "amber", "lime"],
  defaultTheme: localStorage.getItem("selected-theme") || "magenta",
  PROFILES: [],
  ACTIVE_PROFILE: null,
  LAST_PROFILE: null,        // for `cd -`
  timezones: ["Europe/London", "Europe/Berlin"],
  LINK_ALIASES: {},          // label -> URL
};
