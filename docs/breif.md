# Engineering Brief — Startpage

## Goal
Ship a modular, zero‑build start page with **profiles**, **bookmarks overlay**, **client‑side E2E sync**, **autocomplete commands**, **optional timers**, **offline pack**, and **stable theming**, deployed on **Cloudflare Pages** + **Pages Functions** + **Workers KV**.

The UI must remain compatible with existing CSS:
- Groups render under `#links` using the `.links` grid.
- Clocks render under `#clocks`; scratchpad under `#scratch`.
- Theme `<link>` paths use forward slashes.

## Architecture

- **Static app**: `index.html` loads `assets/js/main.js` (ESM); no bundler.
- **Baseline data**: `profiles.json` + `links-<profile>.json` (fallback to `links-default.json`).
- **Overlay (per profile)**: encrypted JSON in KV, merged at render; overlay wins on same label.

### Modules
`assets/js/`: `state.js`, `theme.js`, `profiles.js`, `clocks.js`, `links.js`, `search.js`, `commands.js`, `timers.js` (optional), `bookmarks.js` (overlay; planned), `sync.js` (planned), `offline.js` (planned), `main.js`.

### Pages Functions (API)
`/functions/api/p/[profile]/bookmarks.ts` and `/scratchpad.ts`  
- **GET** → `{ version, envelope }` (ciphertext only)  
- **PUT** guarded by `Authorization: Bearer <writeToken>` and `If-Match: "<version>"` → `204` or `409 { serverVersion, serverEnvelope }`

### Data Models

**Baseline links** (`links-<profile>.json`)
```json
{
  "title": "SBA Startpage – Default",
  "theme": "magenta",
  "timezones": ["Europe/London", "Europe/Berlin"],
  "sections": [
    { "title": "// Productivity", "items": [ { "label":"Sheets","url":"..." } ] }
  ]
}

Overlay (KV, encrypted)
{
  "version": 9,
  "groups": {
    "Work": [ { "label": "Router", "url": "http://router.lan", "pinned": true } ]
  },
  "hide": ["Some Baseline Label"],
  "sort": { "groups": "insertion", "labels": { "default": "insertion", "Work": "smart" } },
  "order": { "groups": ["// Productivity", "// Work"], "labels": { "Work": ["Router"] } }
}

E2E envelope stored in KV
{ "v":1, "salt":"<b64>", "iv":"<b64>", "ciphertext":"<b64>", "kdf":{"alg":"PBKDF2","iter":300000} }
KDF: PBKDF2‑HMAC‑SHA‑256 (≥300k), random 16‑byte salt. Cipher: AES‑GCM with 12‑byte IV.

Commands

Now: help, ls, pwd, cd, bm ls, theme, date, tz add|rm|ls, note|cat notes|rm notes, g|ddg|yt|r|hn, timer (optional).
To build next: bm add|rm|mv|ren|hide|unhide|sort|apply|reset|export|import, groups sort, sync ..., notes sync ..., offline ....

Acceptance Criteria

ESM entry only; #cmd-hints exists; no console errors; input clears on navigate and on bfcache restore.

bm ls lists from live DOM; overlay merges and wins; filters work.

Profiles switch updates theme, links, clocks, and title.

Sync: ciphertext‑only server; guarded writes; conflicts presented to user.

Offline: shell loads offline; queued writes flush when back online.

Testing

Manual smoke

Focus/back behavior, / shortcut, Esc clearing, autocomplete rendering, command routing.

URL/IP/hostname/.local|.lan routing; shortcuts open expected search engines.

Profiles (ls, cd <id>, menu); clocks (tz add/rm/ls); notes persistence.

Timers (create/list/cancel/persist/notify).

_headers verified in Network tab: HTML/JSON no-store, JS must-revalidate, CSS immutable.

Playwright (minimum)

Input focus on load and after bfcache restore.

bm ls modal lists anchors; filtering narrows list.

Profile change updates DOM title and #profile-badge text.

tz add UTC renders a UTC clock; tz rm UTC removes it.

Timer lifecycle: create 10s, observe countdown and toast/notification, persistence across reload.

(future) Sync: PUT with missing Bearer fails; If-Match mismatch returns 409.

Unit-ish

parseDuration edge cases: 12:34, 01:02:03, 1h30m10s, 90s, 500ms, bare integer seconds; fix hh:mm:ss seconds index bug.

Tooling & CI

ESLint + Prettier (defaults); GitHub Actions runs lint + Playwright headless.

Cloudflare Pages preview per PR; merge only on green.

Risks & Mitigations

Selector churn breaks themes → lock hooks; tests assert their presence.

Cache staleness → _headers + ?v= on module script.

Multi‑device write conflicts → If-Match + diff modal; user picks resolution.


---

## ✅ New `README.md`

(Built from the current code paths and the intended features so devs landing in the repo can hit the ground running.) 

```markdown
# Startpage

A zero‑build, modular start page with profiles, groups/bookmarks, a command bar with autocomplete, clocks, a local scratchpad, optional timers, and the path to E2E‑encrypted sync + offline.

## Quick start

- Serve statically (any simple server works):
  - VS Code Live Server, or
  - `python -m http.server` → open http://localhost:8000
- Edit `profiles.json` and `links-default.json` (or add `links-<profile>.json`).
- Open the page; use `/` to focus the command bar.

> The app is pure ESM. `index.html` loads `assets/js/main.js`. Theme `<link>`s and layout CSS must use forward slashes. Keep `#links`, `.links`, `#clocks`, `#scratch`, and `#cmd-hints` present. :contentReference[oaicite:34]{index=34}

## Features

- **Profiles**: switch via menu or `cd <id>` (IDs are lowercase). :contentReference[oaicite:35]{index=35}
- **Groups & bookmarks**: defined in `links-<profile>.json`, rendered under `#links`; `bm ls [filter]` shows live aliases. :contentReference[oaicite:36]{index=36}
- **Search & commands**: free‑form routing; shortcuts `g|ddg|yt|r|hn`; `help` for topics. 
- **Clocks**: `tz add/rm/ls`. :contentReference[oaicite:38]{index=38}
- **Scratchpad**: local persistence in this browser.
- **Timers (optional)**: `timer 10m "Tea"`, `timer ls`, `timer rm all`. :contentReference[oaicite:39]{index=39}

## Commands (cheat sheet)

ls | pwd | cd <profile> | cd -
bm ls [filter]
theme <name>
date | tz add <IANA> | tz rm <IANA> | tz ls
note <text> | cat notes | rm notes
g|ddg|yt|r|hn <q>
timer <dur> [label] | timer ls | timer rm <id|all>


## Data

- **profiles**: `profiles.json` (lowercase ids), optional `theme` and default `timezones`. :contentReference[oaicite:40]{index=40}
- **links**: `links-default.json` (and `links-<id>.json`) supply `"sections":[{"title":"// Group","items":[{"label","url"}]}]`. `title/theme/timezones` in the file override profile defaults. 

## Testing

- **Manual smoke**: focus/back (`/`, `Esc`), search/shortcuts, `bm ls`, profiles + clocks, notes, timers, `_headers` behavior.
- **Playwright**: see `AGENTS.md` for the minimum matrix and add specs accordingly.

## Deploy (Cloudflare Pages)

- Framework: **None**; Build: *(blank)*; Output: `/`.  
- KV + Pages Functions land later for sync; they store ciphertext only. :contentReference[oaicite:42]{index=42}

## Contributing

- Conventional Commits; PRs must update docs and tests; do **not** change selector hooks.
- For stubborn caches, bump `?v=` on `<script type="module" src="assets/js/main.js?v=...">`. :contentReference[oaicite:43]{index=43}

## License

MIT (see `LICENSE`).
