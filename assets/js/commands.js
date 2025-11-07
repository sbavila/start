import { state } from "./state.js";
import { changeCSS } from "./theme.js";
import { routeSearch, clearCommandLine } from "./search.js";
import { renderClocks, startClockTicker } from "./clocks.js";
import { setProfile } from "./profiles.js";
import { createTimer, cancelTimer, cancelAllTimers, listTimers, parseDuration } from "./timers.js";
import { refreshLinks } from "./links.js";
import {
  loadOverlay,
  saveOverlay,
  addBookmark,
  removeBookmark,
  moveBookmark,
  renameBookmark,
  hideBookmark,
  unhideBookmark,
  setSort,
  setGroupSortMode,
  applyOrder,
  resetOrder,
  normalizeImportedOverlay,
} from "./bookmarks.js";

// Modal helpers
const esc = (s)=> (s||"").replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const pre = (t)=> `<pre class="modal-pre">${esc(t)}</pre>`;
const HELP_OVERVIEW = pre([
  "Commands:",
  "  help [topic]          Show this list or topic-specific help",
  "  ls [profiles|tz|groups|bookmarks]",
  "  bm ls [filter]        List bookmarks (filter optional)",
  "  bm add \"Label\" <url> [#Group]",
  "  bm rm <label|#n>      Remove bookmark or hide a baseline entry",
  "  bm mv \"Label\" #Group   Move a bookmark to a different group",
  "  bm ren \"Old\" \"New\"  Rename a bookmark label",
  "  bm hide|unhide \"Label\"",
  "  bm sort … | bm sort apply | bm sort reset",
  "  groups sort insertion|alpha|smart",
  "  bm export | bm import",
  "  pwd | cd <profile>    Show or change profile",
  "  theme <name>          Switch theme",
  "  date                  Show today’s date",
  "  tz ls | tz add <IANA> | tz rm <IANA>",
  "  note <text> | cat notes | rm notes",
  "  timer <dur> [label] | timer ls | timer rm <id|all>",
  "",
  "Shortcuts:",
  "  g <q> | ddg <q> | yt <q> | r <sub> | hn",
  "",
  "Tip: Anything else searches DuckDuckGo or opens URLs directly."
].join("\n"));
function showModal(title, html, options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "presentation");

  const modalId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  const titleId = `${modalId}-title`;

  overlay.innerHTML = `
    <div class="modal-window" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <button class="modal-close" aria-label="Close">×</button>
      <h3 class="modal-title" id="${titleId}">${esc(title)}</h3>
      <div class="modal-body">${html}</div>
      <div class="modal-actions"><button class="modal-ok">OK</button></div>
    </div>`;

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.appendChild(overlay);

  const dialog = overlay.querySelector(".modal-window");
  const closeBtn = overlay.querySelector(".modal-close");
  const okBtn = overlay.querySelector(".modal-ok");
  const bodyEl = overlay.querySelector(".modal-body");

  const focusables = Array.from(
    overlay.querySelectorAll(
      'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute("disabled"));

  const restoreFocus = () => {
    if (previouslyFocused) {
      previouslyFocused.focus();
      return;
    }
    document.getElementById("search_box")?.focus();
  };

  const close = () => {
    overlay.remove();
    clearCommandLine();
    window.removeEventListener("keydown", onKeyDown);
    options.onClose?.();
    restoreFocus();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab" && focusables.length) {
      const currentIndex = focusables.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      if (currentIndex === -1) {
        nextIndex = event.shiftKey ? focusables.length - 1 : 0;
      } else if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
      }
      event.preventDefault();
      focusables[nextIndex].focus();
    }
  };

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      event.preventDefault();
      close();
    }
  });
  const handleOk = () => {
    if (options.onOk) {
      try {
        const outcome = options.onOk({ overlay, dialog, body: bodyEl, okButton: okBtn, close });
        if (outcome === false) return;
        if (outcome && typeof outcome.then === "function") {
          outcome
            .then((result) => {
              if (result === false) return;
              close();
            })
            .catch(() => close());
          return;
        }
      } catch (error) {
        console.error(error);
        return;
      }
    }
    close();
  };
  closeBtn.addEventListener("click", close);
  okBtn.addEventListener("click", handleOk);
  window.addEventListener("keydown", onKeyDown);

  options.onShow?.({ overlay, dialog, body: bodyEl, okButton: okBtn, close });

  dialog.focus();
  (focusables[0] || okBtn).focus();
}

// Commands
export async function runCommand(line) {
  const raw = line.slice(1).trim();
  if (!raw) {
    clearCommandLine();
    return;
  }
  const tokens = tokenizeCommand(raw);
  if (!tokens.length) {
    clearCommandLine();
    return;
  }
  const cmd = tokens[0].toLowerCase();
  const rest = tokens.slice(1);
  const arg = rest.join(" ");

  try {
    switch (cmd) {
      case "help": {
        const topic = (rest[0] || "").toLowerCase();
        if (!topic) {
          showModal("Help", HELP_OVERVIEW);
          break;
        }
        if (topic === "bm" || topic === "bookmarks") {
          showModal(
            "Help — bm",
            pre(
              [
                "bm ls [filter]",
                "  List bookmarks from the rendered page (filter optional).",
                "",
                "bm add \"Label\" <url> [#Group]",
                "  Add a bookmark. Group defaults to the first visible group.",
                "",
                "bm rm <label|#n>",
                "  Remove overlay bookmarks or hide baseline entries.",
                "",
                "bm mv \"Label\" #Group",
                "  Move a bookmark to another group (creates the group if needed).",
                "",
                "bm ren \"Old\" \"New\"",
                "  Rename a bookmark label.",
                "",
                "bm hide|unhide \"Label\"",
                "  Temporarily hide or restore a bookmark.",
                "",
                "bm sort insertion|alpha|smart",
                "bm sort #Group alpha|smart|insertion",
                "bm sort apply | bm sort reset",
                "  Adjust sort modes or capture/reset DOM order.",
                "",
                "groups sort insertion|alpha|smart",
                "  Sort groups globally.",
                "",
                "bm export | bm import",
                "  Export or import overlay JSON.",
              ].join("\n")
            )
          );
          break;
        }
        showModal("Help", `<p>Unknown topic. Showing general help instead.</p>${HELP_OVERVIEW}`);
        break;
      }

      case "ls": {
        const sub = (rest[0] || "").toLowerCase();
        if (!rest.length || sub === "profiles") showProfiles();
        else if (sub === "tz" || sub === "time") tzCmd("ls");
        else if (sub === "links" || sub === "groups") showGroups();
        else if (sub === "bookmarks") showBookmarks(rest.slice(1).join(" "));
        else
          showModal(
            "ls",
            "Try <code>ls</code> | <code>ls tz</code> | <code>ls groups</code> | <code>ls bookmarks</code>"
          );
        break;
      }

      case "bm": {
        await handleBookmarkCommand(rest);
        break;
      }

      case "labels": {
        showModal("Bookmarks", pre("Heads‑up: <labels> is deprecated.\nUse: bm ls [filter]\n\nListing now…"));
        showBookmarks(rest.join(" "));
        break;
      }

      case "pwd":
        showModal("Current profile", pre(state.ACTIVE_PROFILE));
        break;

      case "cd": {
        const target = (rest[0] || "").toLowerCase();
        if (!target) {
          showModal("cd", "Usage: <code>cd &lt;profile&gt;</code> or <code>cd -</code>");
          break;
        }
        if (target === "-") {
          if (!state.LAST_PROFILE) {
            showModal("cd", "No previous profile.");
            break;
          }
          const cur = state.ACTIVE_PROFILE;
          setProfile(state.LAST_PROFILE);
          state.LAST_PROFILE = cur;
          break;
        }
        const match = state.PROFILES.find((p) => p.id === target);
        if (!match) {
          showModal("cd", `Unknown profile: <b>${esc(target)}</b>`);
          break;
        }
        state.LAST_PROFILE = state.ACTIVE_PROFILE;
        setProfile(match.id);
        break;
      }

      case "theme": {
        if (!rest.length) {
          showModal("theme", "Usage: <code>theme &lt;name&gt;</code>");
          break;
        }
        if (!state.themes.includes(rest[0])) {
          showModal("theme", `Unknown theme: <b>${esc(rest[0])}</b>`);
          break;
        }
        changeCSS(rest[0]);
        break;
      }

      case "date":
        showDate();
        break;

      case "tz": {
        tzCmd(rest[0], rest.slice(1).join(" "));
        break;
      }

      case "note": {
        const txt = document.getElementById("scratch");
        if (!txt) break;
        if (!arg) {
          showModal("note", "Usage: <code>note &lt;text&gt;</code>");
          break;
        }
        txt.value += (txt.value ? "\n" : "") + arg;
        localStorage.setItem("scratchpad", txt.value);
        break;
      }

      case "cat": {
        if (rest[0] === "notes") {
          const txt = document.getElementById("scratch");
          showModal("Notes", pre(txt?.value || "(empty)"));
        } else {
          showModal("cat", "Usage: <code>cat notes</code>");
        }
        break;
      }

      case "rm":
      case "clear": {
        if (rest.join(" ") === "notes") {
          const txt = document.getElementById("scratch");
          if (txt) {
            txt.value = "";
            localStorage.removeItem("scratchpad");
          }
        } else {
          showModal(cmd, "Usage: <code>rm notes</code>");
        }
        break;
      }

      case "g":
      case "ddg":
      case "yt":
      case "r":
      case "hn": {
        routeSearch("." + [cmd, ...rest].join(" "), runCommand);
        break;
      }

      case "timer": {
        const sub = (rest[0] || "").toLowerCase();
        if (!sub) {
          showModal(
            "timer",
            "Usage: <code>timer &lt;dur&gt; [label]</code> · <code>timer ls</code> · <code>timer rm &lt;id|all&gt;</code>"
          );
          break;
        }

        if (sub === "ls") {
          const rows = listTimers().map(
            (t) => `${t.id.slice(-6)}  ${t.label}  ends ${new Date(t.endAt).toLocaleTimeString()}`
          );
          showModal("Timers", pre(rows.join("\n") || "(none)"));
          break;
        }

        if (sub === "rm") {
          const target = rest[1];
          if (target === "all") {
            cancelAllTimers();
          } else if (target) {
            cancelTimer(findTimerId(target));
          } else {
            showModal("timer rm", "Usage: <code>timer rm &lt;id|all&gt;</code>");
          }
          break;
        }

        const durMs = parseDuration(sub);
        const label = rest.slice(1).join(" ") || "Timer";
        if (!durMs) {
          showModal(
            "timer",
            "Couldn’t parse duration. Try <code>10m</code>, <code>1h30m</code>, <code>15:00</code>…"
          );
          break;
        }

        const t = createTimer(durMs, label);
        if (t) {
          showModal(
            "Timer started",
            pre(`${t.label}\nEnds at: ${new Date(t.endAt).toLocaleTimeString()}\nID: ${t.id.slice(-6)}`)
          );
        }
        break;
      }

      case "groups": {
        const sub = (rest[0] || "").toLowerCase();
        if (!sub) {
          showGroups();
          break;
        }
        if (sub !== "sort") {
          showModal("groups", "Usage: <code>groups sort insertion|alpha|smart</code>");
          break;
        }
        const mode = (rest[1] || "").toLowerCase();
        if (!isValidSortMode(mode)) {
          showModal("groups sort", "Usage: <code>groups sort insertion|alpha|smart</code>");
          break;
        }
        let overlay = loadOverlay(state.ACTIVE_PROFILE);
        overlay = setGroupSortMode(overlay, mode);
        saveOverlay(state.ACTIVE_PROFILE, overlay);
        await refreshBookmarksUI();
        showModal("Groups sorted", pre(`Groups sort: ${mode}`));
        break;
      }

      default:
        showModal("Unknown command", `No such command: <b>${esc(cmd)}</b>. Try <code>help</code>.`);
    }
  } finally {
    clearCommandLine();
  }
}

function findTimerId(fragmentOrId) {
  const frag = fragmentOrId.toLowerCase();
  const all = listTimers();
  const exact = all.find((t) => t.id === fragmentOrId);
  if (exact) return exact.id;
  const partial = all.find((t) => t.id.endsWith(frag));
  return partial ? partial.id : fragmentOrId; // try raw
}

function showProfiles() {
  const lines = state.PROFILES.map(p => `${p.id} — ${p.label}${p.id===state.ACTIVE_PROFILE ? "  (current)" : ""}`);
  showModal("Profiles", pre(lines.join("\n")));
}

// Links are now called Groups - 
function showGroups() {
  const groups = [...document.querySelectorAll("#links section h3")].map((heading) =>
    heading.textContent.trim()
  );
  showModal("Groups", pre(groups.map((title, index) => `${index + 1}. ${title}`).join("\n") || "(none)"));
}
// NEW: showBookmarks replaces showLabels
function showBookmarks(filter = "") {
  const entries = Object.entries(state.BOOKMARK_ALIASES).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const query = filter.trim().toLowerCase();
  const list = query
    ? entries.filter(([alias]) => alias.includes(query))
    : entries;
  const lines = list.length
    ? list.map(([alias, url]) => `${alias}  ->  ${url}`).join("\n")
    : "(no bookmarks)";
  showModal("Bookmarks", pre(lines));
}

async function handleBookmarkCommand(tokens) {
  const profile = state.ACTIVE_PROFILE;
  const sub = (tokens[0] || "").toLowerCase();
  const tail = tokens.slice(1);

  if (!sub || sub === "ls" || sub === "list") {
    showBookmarks(tail.join(" "));
    return;
  }

  if (sub === "export") {
    const overlay = loadOverlay(profile);
    showModal(
      "Overlay export",
      `<p>Copy this JSON to back up your overlay.</p>${pre(JSON.stringify(overlay, null, 2))}`
    );
    return;
  }

  if (sub === "import") {
    showModal(
      "Overlay import",
      [
        "<p>Paste overlay JSON below. The current overlay will be replaced after confirmation.</p>",
        '<textarea id="bm-import-text" rows="10" cols="60" spellcheck="false"></textarea>',
        '<p class="modal-error" role="alert"></p>',
      ].join(""),
      {
        onShow: ({ body }) => {
          const textarea = body.querySelector("#bm-import-text");
          const errorEl = body.querySelector(".modal-error");
          if (textarea) {
            textarea.focus();
            textarea.select();
          }
          if (errorEl) errorEl.textContent = "";
        },
        onOk: async ({ body }) => {
          const textarea = body.querySelector("#bm-import-text");
          const errorEl = body.querySelector(".modal-error");
          if (!textarea) return false;
          try {
            const parsed = JSON.parse(textarea.value || "{}");
            const normalized = normalizeImportedOverlay(parsed);
            saveOverlay(profile, normalized);
            await refreshBookmarksUI();
            setTimeout(() => showModal("Import complete", pre("Overlay imported.")), 0);
          } catch (error) {
            if (errorEl) {
              errorEl.textContent = error?.message || "Invalid overlay JSON.";
            }
            return false;
          }
        },
      }
    );
    return;
  }

  let overlay = loadOverlay(profile);

  if (sub === "add") {
    const label = tail[0];
    const url = tail[1];
    if (!label || !url) {
      showModal(
        "bm add",
        'Usage: <code>bm add &quot;Label&quot; &lt;url&gt; [#Group]</code>'
      );
      return;
    }
    const group = tail[2] ? resolveGroupName(tail[2]) : defaultGroupNameFromDom();
    overlay = addBookmark(overlay, { label, url, group });
    saveOverlay(profile, overlay);
    await refreshBookmarksUI();
    showModal("Bookmark added", pre(`Added "${label}" → ${url}\nGroup: ${group}`));
    return;
  }

  if (sub === "rm") {
    const target = tail.join(" ");
    if (!target) {
      showModal("bm rm", "Usage: <code>bm rm &lt;label|#n&gt;</code>");
      return;
    }
    let label = target;
    if (/^#\d+$/.test(target)) {
      const index = parseInt(target.slice(1), 10);
      if (!Number.isFinite(index) || index <= 0) {
        showModal("bm rm", "Index must be a positive number.");
        return;
      }
      const info = findBookmarkByIndex(index);
      if (!info) {
        showModal("bm rm", `No bookmark #${index}.`);
        return;
      }
      label = info.label;
    }
    overlay = removeBookmark(overlay, label);
    saveOverlay(profile, overlay);
    await refreshBookmarksUI();
    showModal("Bookmark removed", pre(`Removed "${label}".`));
    return;
  }

  if (sub === "mv") {
    const label = tail[0];
    const groupToken = tail[1];
    if (!label || !groupToken) {
      showModal("bm mv", 'Usage: <code>bm mv &quot;Label&quot; #Group</code>');
      return;
    }
    const destination = resolveGroupName(groupToken);
    if (!destination) {
      showModal("bm mv", "Provide a destination group (e.g. <code>#Tools</code>).");
      return;
    }
    if (overlayEntryForLabel(overlay, label)) {
      overlay = moveBookmark(overlay, label, destination);
    } else {
      const info = findBookmarkDetails(label);
      if (!info) {
        showModal("bm mv", `Unknown bookmark: <b>${esc(label)}</b>`);
        return;
      }
      overlay = addBookmark(overlay, { label: info.label, url: info.url, group: destination });
    }
    saveOverlay(profile, overlay);
    await refreshBookmarksUI();
    showModal("Bookmark moved", pre(`"${label}" → ${destination}`));
    return;
  }

  if (sub === "ren") {
    const oldLabel = tail[0];
    const newLabel = tail[1];
    if (!oldLabel || !newLabel) {
      showModal("bm ren", 'Usage: <code>bm ren &quot;Old&quot; &quot;New&quot;</code>');
      return;
    }
    if (overlayEntryForLabel(overlay, oldLabel)) {
      overlay = renameBookmark(overlay, oldLabel, newLabel);
    } else {
      const info = findBookmarkDetails(oldLabel);
      if (!info) {
        showModal("bm ren", `Unknown bookmark: <b>${esc(oldLabel)}</b>`);
        return;
      }
      overlay = addBookmark(overlay, { label: newLabel, url: info.url, group: info.group });
      overlay = hideBookmark(overlay, oldLabel);
    }
    saveOverlay(profile, overlay);
    await refreshBookmarksUI();
    showModal("Bookmark renamed", pre(`"${oldLabel}" → "${newLabel}"`));
    return;
  }

  if (sub === "hide" || sub === "unhide") {
    const label = tail.join(" ");
    if (!label) {
      showModal(`bm ${sub}`, `Usage: <code>bm ${sub} &quot;Label&quot;</code>`);
      return;
    }
    overlay = sub === "hide" ? hideBookmark(overlay, label) : unhideBookmark(overlay, label);
    saveOverlay(profile, overlay);
    await refreshBookmarksUI();
    showModal(
      sub === "hide" ? "Bookmark hidden" : "Bookmark restored",
      pre(`${sub === "hide" ? "Hidden" : "Restored"} "${label}"`)
    );
    return;
  }

  if (sub === "sort") {
    const target = (tail[0] || "").toLowerCase();
    if (!target) {
      showModal(
        "bm sort",
        "Usage: <code>bm sort insertion|alpha|smart</code> · <code>bm sort #Group alpha|smart|insertion</code> · <code>bm sort apply</code> · <code>bm sort reset</code>"
      );
      return;
    }
    if (target === "apply") {
      overlay = applyOrder(overlay, collectRenderedData());
      saveOverlay(profile, overlay);
      await refreshBookmarksUI();
      showModal("Order captured", pre("Stored the current bookmark order."));
      return;
    }
    if (target === "reset") {
      overlay = resetOrder(overlay);
      saveOverlay(profile, overlay);
      await refreshBookmarksUI();
      showModal("Order reset", pre("View order reset to sort rules."));
      return;
    }
    if (target.startsWith("#")) {
      const mode = (tail[1] || "").toLowerCase();
      if (!isValidSortMode(mode)) {
        showModal("bm sort", "Usage: <code>bm sort #Group alpha|smart|insertion</code>");
        return;
      }
      const groupName = resolveGroupName(tail[0]);
      overlay = setSort(overlay, { group: groupName, mode });
      saveOverlay(profile, overlay);
      await refreshBookmarksUI();
      showModal("Group sort updated", pre(`${groupName}: ${mode}`));
      return;
    }
    if (isValidSortMode(target)) {
      overlay = setSort(overlay, { mode: target });
      saveOverlay(profile, overlay);
      await refreshBookmarksUI();
      showModal("Sort updated", pre(`Default sort: ${target}`));
      return;
    }
    showModal(
      "bm sort",
      "Usage: <code>bm sort insertion|alpha|smart</code> · <code>bm sort #Group alpha|smart|insertion</code> · <code>bm sort apply</code> · <code>bm sort reset</code>"
    );
    return;
  }

  showModal(
    "bm",
    "Unknown bookmark command. Try <code>bm ls</code> | <code>bm add</code> | <code>bm rm</code> | <code>bm mv</code> | <code>bm ren</code> | <code>bm hide</code> | <code>bm sort</code>."
  );
}

async function refreshBookmarksUI() {
  const linksEl = document.getElementById("links");
  const clocksEl = document.getElementById("clocks");
  await refreshLinks(linksEl, clocksEl);
}

function tokenizeCommand(raw) {
  const tokens = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|[^\s]+/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1].replace(/\\(["'])/g, "$1"));
    } else if (match[2] !== undefined) {
      tokens.push(match[2].replace(/\\(["'])/g, "$1"));
    } else {
      tokens.push(match[0]);
    }
  }
  return tokens;
}

function isValidSortMode(mode) {
  return ["insertion", "alpha", "smart"].includes(mode);
}

function cleanGroupHeading(text) {
  return (text || "").replace(/^\/\/+\s*/, "").trim();
}

function getExistingGroupRecords() {
  return Array.from(document.querySelectorAll("#links section h3")).map((heading) => {
    const raw = cleanGroupHeading(heading.textContent || "");
    return { raw: raw || "Links", key: raw.toLowerCase() };
  });
}

function defaultGroupNameFromDom() {
  const groups = getExistingGroupRecords();
  return groups[0]?.raw || "Bookmarks";
}

function parseGroupToken(token) {
  if (typeof token !== "string") return "";
  const trimmed = token.trim();
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return cleanGroupHeading(withoutHash);
}

function resolveGroupName(token) {
  const desired = parseGroupToken(token);
  if (!desired) return "";
  const match = getExistingGroupRecords().find((record) => record.key === desired.toLowerCase());
  return match ? match.raw : desired;
}

function normalizeLabelText(text) {
  return typeof text === "string" ? text.trim().toLowerCase() : "";
}

function findBookmarkDetails(label) {
  const key = normalizeLabelText(label);
  if (!key) return null;
  const sections = document.querySelectorAll("#links section");
  for (const section of sections) {
    const heading = section.querySelector("h3");
    const group = cleanGroupHeading(heading?.textContent || "");
    const anchors = section.querySelectorAll("a");
    for (const anchor of anchors) {
      const text = (anchor.textContent || "").trim();
      if (normalizeLabelText(text) === key) {
        return {
          label: text,
          url: anchor.getAttribute("href") || anchor.href || "",
          group: group || defaultGroupNameFromDom(),
        };
      }
    }
  }
  return null;
}

function findBookmarkByIndex(index) {
  const anchors = Array.from(document.querySelectorAll("#links a"));
  const anchor = anchors[index - 1];
  if (!anchor) return null;
  const section = anchor.closest("section");
  const heading = section?.querySelector("h3");
  const group = cleanGroupHeading(heading?.textContent || "");
  return {
    label: (anchor.textContent || "").trim(),
    url: anchor.getAttribute("href") || anchor.href || "",
    group: group || defaultGroupNameFromDom(),
  };
}

function overlayEntryForLabel(overlay, label) {
  const key = normalizeLabelText(label);
  const groups = overlay?.groups || {};
  for (const [groupName, list] of Object.entries(groups)) {
    const entry = (Array.isArray(list) ? list : []).find((item) => normalizeLabelText(item.label) === key);
    if (entry) {
      return { groupName, entry };
    }
  }
  return null;
}

function collectRenderedData() {
  const sections = Array.from(document.querySelectorAll("#links section")).map((section) => {
    const heading = section.querySelector("h3");
    const title = cleanGroupHeading(heading?.textContent || "Links") || "Links";
    const items = Array.from(section.querySelectorAll("a")).map((anchor) => ({
      label: (anchor.textContent || "").trim(),
      url: anchor.getAttribute("href") || anchor.href || "",
    }));
    return { title, items };
  });
  return { sections };
}

function showDate() {
  const now = new Date();
  const out = state.timezones.map(tz => {
    try {
      const t = new Intl.DateTimeFormat("en-GB",{ timeZone: tz, hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
      return `${tz}: ${t}`;
    } catch { return `${tz}: [invalid tz]`; }
  });
  showModal("Time", pre(out.join("\n")));
}
function tzCmd(sub, zone) {
  switch ((sub||"").toLowerCase()) {
    case "add":
      if (!zone) return showModal("tz add", "Usage: <code>tz add &lt;IANA_tz&gt;</code>");
      if (!state.timezones.includes(zone)) state.timezones.push(zone);
      rerenderClocks(); break;
    case "rm":
    case "remove":
      if (!zone) return showModal("tz rm", "Usage: <code>tz rm &lt;IANA_tz&gt;</code>");
      { const i = state.timezones.indexOf(zone); if (i >= 0) state.timezones.splice(i,1); }
      rerenderClocks(); break;
    case "ls":
    case "list":
      showModal("Timezones", pre(state.timezones.join("\n") || "(none)")); break;
    default:
      showModal("tz", "Usage: <code>tz add &lt;IANA_tz&gt;</code> · <code>tz rm &lt;IANA_tz&gt;</code> · <code>tz ls</code>");
  }
}
function rerenderClocks() {
  const clocksEl = document.getElementById("clocks");
  if (clocksEl) { renderClocks(clocksEl); startClockTicker(clocksEl); }
}

/* Autocomplete */
export function initCommandHints() {
  const input = document.getElementById("search_box");
  const hints = document.getElementById("cmd-hints");
  if (!input || !hints) return;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "cmd-hints");
  input.setAttribute("aria-expanded", "false");

  let items = [];
  let sel = -1;

  const hintId = (index) => `cmd-hint-${index}`;

  const updateActiveDescendant = () => {
    if (sel >= 0 && hints.children[sel]) {
      input.setAttribute("aria-activedescendant", hints.children[sel].id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const hide = () => {
    hints.style.display = "none";
    hints.setAttribute("aria-hidden", "true");
    input.setAttribute("aria-expanded", "false");
    sel = -1;
    items = [];
    hints.innerHTML = "";
    updateActiveDescendant();
  };

  const show = () => {
    hints.style.display = items.length ? "block" : "none";
    hints.setAttribute("aria-hidden", items.length ? "false" : "true");
    input.setAttribute("aria-expanded", items.length ? "true" : "false");
    updateActiveDescendant();
  };

  const render = () => {
    hints.innerHTML = items
      .map(
        (it, index) =>
          `<div id="${hintId(index)}" class="hint${index === sel ? " active" : ""}" role="option" aria-selected="${index === sel}">${esc(
            it.label
          )}</div>`
      )
      .join("");
    updateActiveDescendant();
  };

  const move = (delta) => {
    if (!items.length) return;
    sel = (sel + delta + items.length) % items.length;
    render();
  };

  const apply = (selected) => {
    const choice = selected ?? items[sel];
    if (!choice) return;
    input.value = "." + choice.replace;
    if (!choice.replace.endsWith(" ")) {
      runCommand(input.value);
      hide();
      return;
    }
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    show();
  };

  const basePool = [
    "help",
    "ls ",
    "ls groups",
    "ls links",
    "ls bookmarks",
    "pwd",
    "cd ",
    "cd -",
    "bm ",
    "bm ls ",
    "bm add \"",
    "bm rm ",
    "bm mv \"",
    "bm ren \"",
    "bm hide \"",
    "bm unhide \"",
    "bm sort ",
    "bm sort apply",
    "bm sort reset",
    "bm export",
    "bm import",
    "groups sort ",
    "theme ",
    "date",
    "tz ",
    "tz ls",
    "tz add ",
    "tz rm ",
    "note ",
    "cat notes",
    "rm notes",
    "g ",
    "ddg ",
    "yt ",
    "r ",
    "hn ",
  ];

  const baseSuggestions = (token) => {
    const norm = token.toLowerCase();
    return basePool
      .filter((entry) => entry.toLowerCase().startsWith(norm))
      .map((entry) => ({ label: entry, replace: entry }));
  };

  const suggestionsFor = (token) => {
    const rawToken = token;
    const trimmed = rawToken.trimStart();
    if (!trimmed) return baseSuggestions("");

    const parts = tokenizeCommand(trimmed);
    const cmd = (parts[0] || "").toLowerCase();
    const rest = parts.slice(1);
    const out = [];
    const trailingSpace = /\s$/.test(rawToken);

    const pushGroupSuggestions = () => {
      const match = rawToken.match(/#([^\s]*)$/);
      if (!match) return false;
      const prefix = match[1].toLowerCase();
      const base = rawToken.slice(0, rawToken.length - prefix.length);
      getExistingGroupRecords().forEach((group) => {
        if (!prefix || group.raw.toLowerCase().startsWith(prefix)) {
          out.push({ label: `${base}${group.raw}`, replace: `${base}${group.raw} ` });
        }
      });
      return out.length > 0;
    };

    switch (cmd) {
      case "cd": {
        const prefix = (rest[0] || "").toLowerCase();
        state.PROFILES.forEach((profile) => {
          if (!prefix || profile.id.startsWith(prefix)) {
            out.push({ label: `cd ${profile.id}`, replace: `cd ${profile.id}` });
          }
        });
        out.push({ label: "cd -", replace: "cd -" });
        break;
      }
      case "theme": {
        const prefix = rest[0] || "";
        state.themes.forEach((theme) => {
          if (!prefix || theme.startsWith(prefix)) {
            out.push({ label: `theme ${theme}`, replace: `theme ${theme}` });
          }
        });
        break;
      }
      case "ls": {
        const prefix = rest[0] || "";
        ["profiles", "tz", "groups", "links", "bookmarks"].forEach((section) => {
          if (!prefix || section.startsWith(prefix)) {
            out.push({ label: `ls ${section}`, replace: `ls ${section}` });
          }
        });
        break;
      }
      case "tz": {
        const prefix = (rest[0] || "").toLowerCase();
        ["ls", "add ", "rm "]
          .filter((keyword) => !prefix || keyword.startsWith(prefix))
          .forEach((keyword) => out.push({ label: `tz ${keyword}`, replace: `tz ${keyword}` }));
        if (prefix.startsWith("add")) {
          const search = trimmed.slice(trimmed.indexOf("add") + 3).trim().toLowerCase();
          ["Europe/London", "UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo"].forEach((zone) => {
            if (!search || zone.toLowerCase().includes(search)) {
              out.push({ label: `tz add ${zone}`, replace: `tz add ${zone}` });
            }
          });
        }
        break;
      }
      case "bm": {
        const sub = (rest[0] || "").toLowerCase();
        const subcommands = [
          { key: "ls", entry: "bm ls " },
          { key: "add", entry: "bm add \"" },
          { key: "rm", entry: "bm rm " },
          { key: "mv", entry: "bm mv \"" },
          { key: "ren", entry: "bm ren \"" },
          { key: "hide", entry: "bm hide \"" },
          { key: "unhide", entry: "bm unhide \"" },
          { key: "sort", entry: "bm sort " },
          { key: "export", entry: "bm export" },
          { key: "import", entry: "bm import" },
        ];

        if (!rest.length && !trailingSpace) {
          subcommands
            .filter((item) => item.key.startsWith(sub))
            .forEach((item) => out.push({ label: item.entry, replace: item.entry }));
          break;
        }
        if (!rest.length && trailingSpace) {
          subcommands.forEach((item) => out.push({ label: item.entry, replace: item.entry }));
          break;
        }

        if (sub === "add" || sub === "mv") {
          if (pushGroupSuggestions()) return out;
        }

        if (sub === "sort") {
          if (pushGroupSuggestions()) return out;
          const optionPrefix = (rest[1] || "").toLowerCase();
          const options = ["insertion", "alpha", "smart", "apply", "reset", "#"];
          options
            .filter((opt) => !optionPrefix || opt.startsWith(optionPrefix))
            .forEach((opt) => {
              if (opt === "#") {
                out.push({ label: "bm sort #", replace: "bm sort #" });
              } else {
                out.push({ label: `bm sort ${opt}`, replace: `bm sort ${opt}` });
              }
            });
          break;
        }
        break;
      }
      case "groups": {
        const sub = (rest[0] || "").toLowerCase();
        if (!rest.length) {
          out.push({ label: "groups sort ", replace: "groups sort " });
          break;
        }
        if ("sort".startsWith(sub)) {
          if (sub !== "sort") {
            out.push({ label: "groups sort ", replace: "groups sort " });
          } else {
            const modePrefix = (rest[1] || "").toLowerCase();
            ["insertion", "alpha", "smart"].forEach((mode) => {
              if (!rest[1] || mode.startsWith(modePrefix)) {
                out.push({ label: `groups sort ${mode}`, replace: `groups sort ${mode}` });
              }
            });
          }
        }
        break;
      }
      default:
        return baseSuggestions(trimmed);
    }
    return out.length ? out : baseSuggestions(trimmed);
  };

  input.addEventListener("input", () => {
    const value = input.value.trimStart();
    if (!value.startsWith(".")) {
      hide();
      return;
    }
    const token = value.slice(1);
    items = suggestionsFor(token);
    sel = items.length ? 0 : -1;
    render();
    show();
  });
  input.addEventListener("keydown", (e) => {
    const active = hints.style.display === "block";
    if (e.key === "ArrowDown" && active) { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp"   && active) { e.preventDefault(); move(-1); }
    else if (e.key === "Tab"       && active) { e.preventDefault(); apply(); }
    else if (e.key === "Enter"     && active && sel >= 0) { e.preventDefault(); apply(); }
    else if (e.key === "Escape"    && active) { e.preventDefault(); hide(); clearCommandLine(); }
  });
  hints.addEventListener("mousedown", (e) => {
    const el = e.target.closest(".hint"); if (!el) return;
    const idx = [...hints.children].indexOf(el);
    sel = idx; apply();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hints.style.display !== "block") { clearCommandLine(); }
  });
  input.addEventListener("blur", () => setTimeout(hide, 150));

  hide();
}

export { showGroups as showLinkSections };
