When you change JS, optionally bump ?v=… on the module script to nuke stubborn caches.

Repo layout (target)
/
├─ index.html
├─ _headers
├─ profiles.json
├─ links-default.json
├─ links-<profile>.json
├─ assets/
│  ├─ css/
│  │  └─ layout.css
│  └─ js/
│     ├─ state.js
│     ├─ theme.js
│     ├─ profiles.js
│     ├─ clocks.js
│     ├─ links.js
│     ├─ search.js
│     ├─ commands.js
│     ├─ timers.js              # optional
│     ├─ bookmarks.js           # (overlay; planned)
│     ├─ sync.js                # (KV + E2E; planned)
│     └─ main.js
└─ main-themes/
   ├─ magenta/style.css
   ├─ light/style.css
   ├─ cyan/style.css
   ├─ amber/style.css
   ├─ lime/style.css


In index.html ensure theme links use forward slashes, e.g. main-themes/purple/style.css. Your older file used backslashes which break on the web. Also remove the stray </head>s.

Configuration
Profiles (profiles.json)
{
  "profiles": [
    { "id": "default", "label": "Default", "theme": "purple", "timezones": ["Europe/London","Europe/Berlin"], "default": true },
    { "id": "tour",    "label": "Tour",    "timezones": ["America/New_York","UTC"] }
  ]
}


id is used in the query string and to resolve links-<id>.json.

Case matters on Cloudflare. Keep profile IDs and filenames lowercase: links-default.json, links-tour.json. Your fetch path uses the profile ID verbatim.

Links (baseline)

links-<profile>.json structure:

{
  "title": "Start — Default",
  "theme": "purple",
  "timezones": ["Europe/London","Europe/Berlin"],
  "sections": [
    {
      "title": "// Productivity",
      "items": [
        { "label": "Sheets", "url": "https://docs.google.com/spreadsheets/u/0" },
        { "label": "Docs",   "url": "https://docs.google.com/document/u/0" }
      ]
    },
    {
      "title": "// Current Show",
      "items": [
        { "label": "MTX-001", "url": "http://10.11.11.31" },
        { "label": "PRJ-101", "url": "http://10.11.11.101" }
      ]
    }
  ]
}


Headings render as groups; we prefix them visually with // in the UI.

The bookmark alias map is built from anchor text under #links; typing an exact/unique bookmark name in the bar opens it.

Command bar

Free‑form search: URL/IP/hostname → open; otherwise DuckDuckGo.

Shortcuts: g, ddg, yt, r, hn.

Commands start with >.

Implemented now
help | help bm
ls | ls bookmarks | pwd | cd <profile>
theme <name>
date | tz add <IANA> | tz rm <IANA> | tz ls
note <text> | cat notes | rm notes
bm ls [filter]        # list bookmarks (from the current page)

Planned (next milestones)
bm add "<label>" <url> [#Group]
bm rm <label|#n> | bm mv "<label>" #NewGroup | bm ren "Old" "New"
bm hide "<label>" | bm unhide "<label>"
bm sort insertion|alpha|smart | bm sort #Group alpha | bm sort apply|reset
groups sort insertion|alpha|smart
sync status|init|unlock|lock|passphrase set|token set|on|off|pull|push|share ro|rw
notes sync on|off | notes push|pull
offline pack|use on|use off|status|clear
timer 10m "Label" | timer ls | timer rm <id|all>   # optional, local

Autocomplete

Hints appear when you type >, with arrow/Tab selection. The HTML must include:

<div id="cmd-hints" role="listbox" aria-label="Command suggestions" style="display:none"></div>


We suggest bm, cd, theme, tz, ls subtopics, and later #Group names after bm add … #.

UX polish (already in code)

pageshow handler clears & refocuses the bar on Back/forward cache return.

navigate() clears the input before leaving the page, so the bfcache snapshot isn’t stale.

/ focuses the bar from anywhere. Placeholder: “the world at your fingertips.”

Sync (design; to be implemented)

Overlay (bookmarks + scratchpad) stored in Cloudflare KV via Pages Functions.

E2E encryption: passphrase → PBKDF2‑HMAC‑SHA‑256 (≥300k iter) → AES‑GCM. Server stores ciphertext only.

Write requires a per‑profile Bearer token + If-Match version (optimistic concurrency).

Read‑only share: #k=<key> in URL fragment; read+write (only when intended): #k=…&w=<token>.

Unlock to edit loads secrets into Session (show machines) or Local (personal devices).

Offline (design; to be implemented)

Service Worker pre‑caches the app shell.

offline pack saves a snapshot (baseline + overlay + prefs) to IndexedDB.

offline use on reads from the pack; writes queue locally; offline use off flushes when online.

Theming

Themes are variables‑only colorways under main-themes/<name>/style.css. Layout/structure live in assets/css/layout.css. The old “single big CSS” style works as long as it keeps targeting #links, .links, #clocks, and #scratch (your current CSS does).

Troubleshooting

Autocomplete doesn’t show → missing #cmd-hints element or old monolithic inline script still present. Use the modular loader in index.html.

bm unknown → running older script that lacks the bm case.

Theme not loading → check <link href="main-themes/purple/style.css"> uses forward slashes, not backslashes.

Back button leaves text in the bar → ensure navigate() clears the input and pageshow re‑focuses (present in assets/js/search.js and assets/js/main.js).

Manual smoke tests

Focus & Back: input clears + focuses.

Search heuristics: URL/IP/hostname + shortcuts.

bm ls / bm ls <filter> modal lists bookmarks (derived from anchors under #links).

Profiles: ls, cd <name>.

Clocks: tz add/rm/ls.

Scratchpad: persists across reloads.

Contributing

Conventional Commits.

PRs must include updated docs and Playwright smoke tests (planned).

Keep selectors stable: #links, .links, #clocks, #scratch.

License

MIT (or your choice).


---

## `BRIEF.md`

```markdown
# Engineering Brief — Startpage

## Goal

Deliver a modular, zero‑build start page with **profiles**, **bookmarks overlay**, **sync with client‑side E2E**, **autocomplete commands**, **offline pack**, and **stable theming**, deployed on **Cloudflare Pages** + **Pages Functions** + **Workers KV**.

The UI must remain compatible with existing CSS:
- Links render under `#links` as grouped sections (`.links` styling).
- Clocks render under `#clocks`; scratchpad is `#scratch`.
- Theme `<link>` paths use forward slashes. 

## Architecture

- **Static app**: `index.html` loads `assets/js/main.js` as an ES module; no bundler.
- **Baseline data**: `profiles.json`, `links-<profile>.json`.
- **Overlay (per profile)**: encrypted JSON in KV, merged at render.

### Modules


assets/js/
state.js # shared state
theme.js # <link disabled> theme preloading + switch
profiles.js # load + pick profile; inject menu
clocks.js # render + ticker
links.js # render groups; build bookmark aliases from anchors
search.js # free-form routing, shortcuts, bfcache focus/clear
commands.js # command router, autocomplete, modal helpers
bookmarks.js # overlay CRUD + sort + hide (to implement)
sync.js # KV client + E2E crypto + optimistic concurrency (to implement)
offline.js # SW + IndexedDB pack/queue (to implement)
timers.js # local countdown tiles (optional)
main.js # bootstrap/wiring


### Pages Functions (API)


functions/api/p/[profile]/
bookmarks.ts # GET returns ciphertext envelope; PUT requires bearer + If-Match
scratchpad.ts # identical contract


- KV binding (e.g., `KV_STARTPAGE`) configured in the Pages project.
- Responses set `Cache-Control: no-store`.

## Data models

### Baseline links (read‑only)
```json
{
  "title":"Start — Default",
  "theme":"purple",
  "timezones":["Europe/London","Europe/Berlin"],
  "sections":[
    {"title":"// Productivity","items":[{"label":"Sheets","url":"…"}]}
  ]
}

Overlay (KV, encrypted payload)
{
  "version": 8,
  "groups": {
    "Bookmarks": [ {"label":"MTX-001","url":"http://10.11.11.31","pinned":true} ],
    "Work":      [ {"label":"Router","url":"http://router.lan"} ]
  },
  "hide": ["Some Baseline Label"],
  "sort": { "groups": "insertion", "labels": { "default": "insertion", "Show": "smart" } },
  "order": { "groups": ["01 Show","Bookmarks"], "labels": { "Show": ["MTX-001","PRJ-101"] } }
}

E2E envelope (stored in KV)
{ "v":1, "salt":"<b64>", "iv":"<b64>", "ciphertext":"<b64>", "kdf":{"alg":"PBKDF2","iter":300000} }


KDF: PBKDF2‑HMAC‑SHA‑256 (≥300k iterations), random 16‑byte salt.

Cipher: AES‑GCM, random 12‑byte IV.

API contract

GET /api/p/:profile/bookmarks → 200 { version, envelope }

PUT /api/p/:profile/bookmarks with headers:

Authorization: Bearer <writeToken>

If-Match: "<version>"
→ 204 on success; 409 { serverVersion, serverEnvelope } on conflict.

Reads never require the bearer. Server never sees plaintext.

Commands (UX)
Implemented
help | help bm
ls | ls bookmarks | pwd | cd <profile>
theme <name>
date | tz add <IANA> | tz rm <IANA> | tz ls
note <text> | cat notes | rm notes
bm ls [filter]

To implement (this scope)

Bookmarks

bm add "<label>" <url> [#Group]
bm rm <label|#n> | bm mv "<label>" #NewGroup | bm ren "Old" "New"
bm hide "<label>" | bm unhide "<label>"
bm sort insertion|alpha|smart | bm sort #Group alpha | bm sort apply|reset
groups sort insertion|alpha|smart
bm find <text> | bm export | bm import


Sync

sync status | init | unlock | lock
sync passphrase set | token set
sync on|off | pull | push
sync share ro | sync share rw


Scratchpad

notes sync on|off | notes push | notes pull


Offline

offline pack | offline use on | offline use off | offline status | offline clear


Timers (optional)

timer <dur> "Label" | timer ls | timer rm <id|all>

Autocomplete

Suggestions for bm, cd, theme, tz, ls (subtopics).

After bm add … # suggest existing Group names.

Caching

_headers:

HTML + JSON: no-store

JS: must-revalidate

CSS/themes: immutable

Add ?v= to the module script when needed to bust caches.

Acceptance criteria

Zero‑build ESM; single index.html + modules.

Command bar clears before navigate; on Back, input is cleared and focused.

bm ls modal lists bookmarks from anchors under #links; filter works.

Profiles: ls/cd updates links and clocks.

KV overlay:

Client encrypts before PUT; server stores ciphertext only.

PUT requires bearer; GET works without.

If-Match versioning with conflict modal (scratchpad) and merge by label (bookmarks).

Secrets stored in Session (default on show machines) or Local (personal devices).

Offline pack loads without network; queued writes flush when online.

No breaking changes to theme CSS selectors (#links, .links, #clocks, #scratch).

Milestones

Harden modular app (remove monolithic inline script, ensure #cmd-hints, fix theme link slashes).

Bookmarks overlay + commands (bookmarks.js; add/rm/mv/ren/sort/hide/export/import).

Sync (functions/api/..., sync.js): KV binding, E2E, bearer, optimistic concurrency, status pill, sync commands.

Scratchpad sync (+ diff conflicts).

Offline (offline.js + service worker + IndexedDB pack/queue).

Timers (optional).

Help topics registry + Playwright smoke tests.

Testing

Manual smoke tests in README.

Add Playwright tests for: focus/back behavior, search heuristics, bm ls modal, cd, clocks update, scratchpad persistence, _headers caching behavior (dev server with custom headers).

Security

Never put secrets in query params; use URL fragment (#k=, #w=) or storage.

Reads return ciphertext only.

Writes require bearer + If-Match.

Session‑by‑default storage on show machines.

Tooling

ESLint + Prettier (defaults).

Conventional Commits.

CI: GitHub Actions → deploy preview to Cloudflare Pages per PR.