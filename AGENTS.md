# Agents Guide — Startpage

This document coordinates multiple agents working on **Startpage**.
It defines **roles**, **guardrails**, **milestones**, **PR workflow**, **tests**, and **acceptance criteria**.

---

## 0) Project Snapshot (Truth Anchors)

- Static HTML + ES modules (no bundler). `index.html` loads `assets/js/main.js` via `<script type="module">`. Keep a cache‑busting `?v=` when needed.  
- DOM hooks are stable and **must not change**:  
  - `#links` container (styled via `.links`), groups render as `<section><h3>// Title</h3>…</section>`  
  - `#clocks` for clocks, `#scratch` for the local scratchpad  
  - Command hints container exists as `<div id="cmd-hints">…</div>`  
- Keep **user‑facing terms** consistent: **groups** (sections) contain **bookmarks** (items with a `label` and `url`). “label” is a field on a bookmark; avoid using it to mean the bookmark itself.  
- Theme CSS files are colorways only; layout lives in `assets/css/layout.css`. Paths use **forward slashes**.  
Sources: app shell and modules (index, commands, theme, links, search, layout/theme CSS). 
``index.html`` • ``assets/js/commands.js`` • ``assets/js/theme.js`` • ``assets/js/links.js`` • ``assets/js/search.js`` • ``assets/css/layout.css`` • theme ``style.css``. 
``profiles.json`` and ``links-default.json`` are the baseline. 
``_headers`` carries cache rules.  

---

## 1) Roles

**Planner** — Triages issues, writes acceptance criteria, keeps terminology (“groups”, “bookmarks”, “label”) consistent.

**Frontend Implementer** — Owns `assets/js/` and DOM rendering; ensures command router, autocomplete, accessibility, and bfcache behavior.

**Edge/API Implementer** — Owns Cloudflare Pages Functions under `/functions/api/...` and KV contract; guards bearer auth + optimistic concurrency; server never sees plaintext.

**QA / Test Engineer** — Adds Playwright smoke tests (focus/back, search routing, bookmarks flows, profiles, clocks, scratchpad, timers), and later sync/offline tests.

**Docs** — Keeps `README.md`, `BRIEF.md`, and this `AGENTS.md` aligned with code and UX copy.

---

## 2) Repository Layout (target)

/
├─ index.html # shell + #cmd-hints
├─ _headers # cache rules
├─ profiles.json # profile registry (lowercase ids)
├─ links-default.json # baseline groups/bookmarks
├─ links-<profile>.json # per-profile baseline
├─ assets/
│ ├─ css/
│ │ └─ layout.css # structure/components (theme-agnostic)
│ └─ js/
│ ├─ state.js
│ ├─ theme.js
│ ├─ profiles.js
│ ├─ clocks.js
│ ├─ links.js # render groups, build bookmark aliases
│ ├─ search.js # routing, shortcuts, bfcache focus/clear
│ ├─ commands.js # router + modals + autocomplete
│ ├─ timers.js # optional local timers
│ ├─ bookmarks.js # overlay model + bm operations (planned)
│ ├─ sync.js # KV + E2E + optimistic concurrency (planned)
│ └─ main.js
└─ main-themes/<color>/style.css # variables-only colorways


---

## 3) Invariants & Guardrails

- **Selectors**: Do not rename `#links`, `.links`, `#clocks`, `#scratch`, or drop `#cmd-hints`. Theme CSS assumes these hooks. :contentReference[oaicite:4]{index=4}  
- **Module entry**: Single ESM entry; no legacy inline scripts. `index.html` loads `assets/js/main.js?v=…`.   
- **Focus model**: On load and **bfcache restore**, the command input is cleared & focused; navigating clears it before leaving. :contentReference[oaicite:6]{index=6}  
- **Case sensitivity**: Profile IDs and `links-*.json` are lowercase; filenames and lookups are case‑sensitive on Pages. :contentReference[oaicite:7]{index=7}  
- **Caching**: `_headers` enforces: HTML/JSON `no-store`; JS `must-revalidate`; themes `immutable`; bump `?v=` for stubborn caches. :contentReference[oaicite:8]{index=8}  
- **Security (for sync)**: No secrets in query params; use fragment (`#k=`, `#w=`) or storage. Server stores ciphertext only; writes require Bearer + `If-Match`. :contentReference[oaicite:9]{index=9}

---

## 4) Commands (user-facing, current + planned)

**Implemented now**  
- Profiles: `ls`, `pwd`, `cd <name>`, `cd -`  
- Bookmarks: `bm ls [filter]` (lists aliases from the live DOM)  
- Theming: `theme <name>`  
- Time: `date`, `tz add <IANA>`, `tz rm <IANA>`, `tz ls`  
- Notes: `note <text>`, `cat notes`, `rm notes`  
- Search & shortcuts: free‑form + `g|ddg|yt|r|hn <q>`  
- Timers (optional module): `timer <dur> [label]`, `timer ls`, `timer rm <id|all>`  
Code references: commands, search, timers. 

**Planned (overlay + sync + offline)**  
- Bookmarks overlay: `bm add/rm/mv/ren/hide/unhide/sort/apply/reset/export/import`, `groups sort …`  
- Sync: `sync status|init|unlock|lock|passphrase set|token set|on|off|pull|push|share ro|rw`  
- Scratchpad sync: `notes sync on|off|push|pull`  
- Offline: `offline pack|use on|use off|status|clear`  
:contentReference[oaicite:11]{index=11}

---

## 5) Milestones (execution order)

1) **Harden modular app** (no inline scripts; ensure `#cmd-hints`; verify bfcache focus/clear; fix theme path slashes). :contentReference[oaicite:12]{index=12}  
2) **Bookmarks overlay** (`bookmarks.js`): local overlay model, view sorts, `apply/reset`, import/export. :contentReference[oaicite:13]{index=13}  
3) **Sync** (`functions/api` + `sync.js`): KV binding; GET ciphertext; PUT with Bearer + `If-Match`; E2E in client. :contentReference[oaicite:14]{index=14}  
4) **Scratchpad sync** with conflict resolution. :contentReference[oaicite:15]{index=15}  
5) **Offline** (`offline.js`): SW + IndexedDB pack and queued writes. :contentReference[oaicite:16]{index=16}  
6) **Help topics** + **Playwright tests**. :contentReference[oaicite:17]{index=17}

---

## 6) Acceptance Criteria (per milestone)

- Command bar clears before navigate; on Back, input is cleared & focused; no console errors. :contentReference[oaicite:18]{index=18}  
- `bm ls` lists merged bookmarks once overlay lands; filter works; no selector churn. :contentReference[oaicite:19]{index=19}  
- Profiles switch (`cd`, menu) updates title, theme, links, and clocks.   
- Sync: server stores ciphertext only; writes guarded; conflicts surfaced to UI. :contentReference[oaicite:21]{index=21}  
- Offline: app shell loads with network disabled; queued writes flush when online. :contentReference[oaicite:22]{index=22}

---

## 7) PR Workflow

- Branches: `feature/<slug>`, `fix/<slug>`; Conventional Commits.  
- Every PR: updated docs, smoke tests, `_headers` untouched unless required, no secret leakage, selectors untouched.  
- Merge only after Pages preview is green. :contentReference[oaicite:23]{index=23}

---

## 8) Security & Privacy

- E2E: PBKDF2‑HMAC‑SHA‑256 (≥300k) → AES‑GCM; server stores ciphertext only.  
- PUT requires Bearer + `If-Match`; GET never requires Bearer.  
- Sharing: `#k=<key>` (ro), `#k=…&w=<token>` (rw).  
- On shared machines, store secrets in **session**; personal devices may use **local** storage. :contentReference[oaicite:24]{index=24}

---

## 9) Testing Matrix (minimum)

**Behavior / UX**  
- Input focus on load; `/` shortcut focuses; **Esc** clears; bfcache restore resets and focuses.  
- Routing: URL, IP, `.local/.lan`, and shortcuts.  
- Bookmarks: `bm ls` and filter; (overlay later) `add/rm/mv/ren/hide/unhide/sort/apply/reset/export/import`.  
- Profiles: `ls`, `cd <name>`, menu click.  
- Clocks: `tz add/rm/ls`. Scratchpad: `note`, `cat notes`, `rm notes`.  
- Timers: create, list, cancel, notify, persistence across reloads.

**Functional**  
- Baseline file load order and overrides: `links-<profile>.json` → fall back to `links-default.json`; per‑file `title/theme/timezones` override profile defaults. :contentReference[oaicite:25]{index=25}  
- `_headers` cache rules honored in Network tab; JS revalidates; HTML/JSON no-store. :contentReference[oaicite:26]{index=26}  
- (Later) Sync envelope, PUT auth, conflict path; Offline SW cache + IDB pack.

**Unit-ish**  
- `parseDuration`: `"12:34"` → 754000 ms, `"01:02:03"` → 3723000 ms, `"90s"` → 90000 ms, `"1h30m10s"` → 5410000 ms, `"500ms"` → 500 ms. (Note: fix seconds index in `hh:mm:ss` path.) :contentReference[oaicite:27]{index=27}

---

## 10) Naming & Copy

- Use **groups** and **bookmarks** in UI and docs; “label” is the bookmark’s visible text.  
- Help topics are command-aware (`help bm`, `help tz`, etc.). :contentReference[oaicite:28]{index=28}

---

## 11) Known Sharp Edges

- Removing the legacy inline script in `index.html` is mandatory—use ESM entry and ensure `#cmd-hints` exists. :contentReference[oaicite:29]{index=29}  
- Keep Back‑button bfcache behavior: clear input before navigate; refocus on `pageshow`. :contentReference[oaicite:30]{index=30}  
- Theme selectors assume `#links .links`—don’t churn these. :contentReference[oaicite:31]{index=31}

---

## 12) Definition of Done (DoD)

- Code + docs + tests updated, clean preview build, no console errors.  
- Commands surfaced in autocomplete; `_headers` served as specified.  
- No breakage of theme styling; for sync: ciphertext‑only server + guarded writes + conflict handling.  
