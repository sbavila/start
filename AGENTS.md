# Agents Guide — Startpage

This document coordinates multiple agents working on the **Startpage** project.
It defines **roles**, **guardrails**, **milestones**, **PR workflow**, and **acceptance criteria**.

---

## 0) Project Snapshot (Truth Anchors)

- The app is a **static HTML** start page with **ES modules** (no bundler).
- The DOM must keep these hooks, which theme CSS already targets:
  - `#links` container with grouped sections (`.links` styling). :contentReference[oaicite:2]{index=2}
  - Clocks render under `#clocks`; scratchpad is `#scratch`. :contentReference[oaicite:3]{index=3}
- `index.html` is the shell. It must:
  - Load modules via `<script type="module" src="./assets/js/main.js">`.
  - Include a command **hints container**: `<div id="cmd-hints">…</div>`.
  - Use **forward slashes** in theme hrefs (`main-themes/purple/style.css`). Avoid backslashes.
  - No stray text around `</head>`. :contentReference[oaicite:4]{index=4}
- Keep **user‑facing terms**:
  - **groups** (sections) containing **bookmarks** (aka “bm”).
  - Commands live behind `>` and have autocomplete.

**Never rename** the selectors above or you will break existing themes/layout. :contentReference[oaicite:5]{index=5}

---

## 1) Roles

### Planner
- Triages issues, writes acceptance criteria, sequences milestones.
- Ensures invariants and terminology (“groups”, “bookmarks”) are consistent.

### Frontend Implementer
- Owns ES module code under `assets/js/`.
- Guarantees command router, autocomplete, rendering, accessibility, bfcache behavior.

### Edge/API Implementer
- Owns Cloudflare Pages Functions under `/functions/api/...` and KV integration.
- Enforces bearer auth + optimistic concurrency; never sees plaintext (E2E).

### QA / Test Engineer
- Adds Playwright smoke tests for focus/back, search routing, `bm` flows, profile switching, clocks, scratchpad, and later sync/offline.

### Docs
- Keeps `README.md`, `BRIEF.md`, and this `AGENTS.md` aligned with the code.

---

## 2) Repository Layout (Target)

/
├─ index.html # tiny shell + #cmd-hints
├─ _headers # cache rules (HTML/JSON no-store; JS revalidate)
├─ profiles.json # baseline profile registry (may omit private ones)
├─ links-default.json # baseline groups/bookmarks
├─ links-<profile>.json # baseline per profile
├─ assets/
│ ├─ css/
│ │ └─ layout.css # structure/components (theme-agnostic)
│ └─ js/
│ ├─ state.js
│ ├─ theme.js
│ ├─ profiles.js
│ ├─ clocks.js
│ ├─ links.js
│ ├─ search.js
│ ├─ commands.js
│ ├─ bookmarks.js # overlay model + bm operations
│ ├─ sync.js # E2E + KV client (to implement)
│ ├─ offline.js # SW + IndexedDB pack (to implement)
│ └─ main.js
└─ main-themes/
└─ <colorway>/style.css # variables-only colorways; keep selectors stable
└─ functions/
└─ api/p/[profile]/
├─ bookmarks.ts # GET ciphertext; PUT with bearer+If-Match
└─ scratchpad.ts # same contract



## 3) Invariants & Guardrails

- **Selectors & layout**: keep `#links`, `.links`, `#clocks`, `#scratch` exactly. :contentReference[oaicite:6]{index=6}
- **Themes** are colorways only; do not move layout into theme CSS.
- **Module entry**: `index.html` must load `assets/js/main.js` as ESM; no inline legacy script blocks. :contentReference[oaicite:7]{index=7}
- **Focus model**:
  - On page load and on **bfcache restore**, the command input is **cleared & focused**.
  - `navigate()` clears the input before leaving (prevents stale snapshots).
- **Case sensitivity**: profile IDs and `links-*.json` are **lowercase**; CF Pages is case-sensitive. :contentReference[oaicite:8]{index=8}
- **Caching**: `_headers` file enforces:
  - `index.html`, `profiles.json`, `links-*.json`: `no-store`
  - JS: `must-revalidate`
  - CSS/themes: `immutable`
- **Security** (for sync):
  - No secrets in query **params**; use URL **fragment** (`#k=`, `#w=`) or storage.
  - Server stores **ciphertext only**; writes require **Bearer** + `If-Match`.

---

## 4) Commands (User-Facing)

- **Profiles**: `ls`, `pwd`, `cd <name>|-`
- **Bookmarks**:
  - `bm ls [filter]`
  - `bm add "<label>" <url> [#Group]`
  - `bm rm <label|#n>`
  - `bm mv "<label>" #NewGroup` · `bm ren "Old" "New"`
  - `bm hide "<label>"` · `bm unhide "<label>"`
  - **Sort (view)**: `bm sort insertion|alpha|smart`, `bm sort #Group alpha|smart|insertion`
  - **Persist order**: `bm sort apply|reset`
  - **Groups sort (view)**: `groups sort insertion|alpha|smart`
  - `bm export` · `bm import`
- **Sync** (to implement):
  - `sync status|init|unlock|lock`
  - `sync passphrase set|token set`
  - `sync on|off|pull|push`
  - `sync share ro|rw`
- **Scratchpad**: `note <text>` · `cat notes` · `rm notes`
- **Time**: `date` · `tz add/rm/ls`
- **Search**: free‑form URL/IP/hostname; `g|ddg|yt|r|hn <q>` shortcuts.

Autocomplete must suggest `bm`, `cd`, `theme`, `tz`, `ls` subtopics, and (later) group names after `bm add … #`.

---

## 5) Milestones (Execution Order)

1. **Harden modular app**
   - Ensure `index.html` uses ESM entry and includes `#cmd-hints`.
   - Remove any legacy inline scripts; fix theme href slashes; remove stray tokens near `</head>`. :contentReference[oaicite:9]{index=9}
   - Verify Back/forward **bfcache** focus & clear.

2. **Bookmarks overlay** (`bookmarks.js`)
   - Local overlay in `localStorage` per profile (key `overlay.<profile>.v1`).
   - Merge with baseline at render; overlay wins on same label; hide list masks baseline.
   - Implement `bm add/rm/mv/ren/hide/unhide/sort/apply/reset/export/import`.
   - View sort modes: `insertion|alpha|smart`; `apply` persists to overlay order.

3. **Sync** (`functions/api` + `sync.js`)
   - KV binding; GET returns **ciphertext**; PUT requires **Bearer** and `If-Match`.
   - Client E2E: PBKDF2‑HMAC‑SHA‑256 (≥300k), AES‑GCM.
   - Secrets per profile: `syncSpace`, passphrase→key, write token.
   - Status pill: ○ view‑only / ● syncing / ● synced / ! conflict.

4. **Scratchpad sync**
   - Debounced save; `notes sync on/off` and `push/pull`.
   - Conflict: diff modal; last‑write‑wins only by explicit choice.

5. **Offline** (`offline.js`)
   - Service Worker pre‑cache app shell.
   - `offline pack` snapshot (baseline+overlay+prefs) → IndexedDB.
   - `offline use on|off` with queued writes.

6. **Timers** (optional)
   - Local alarms; optional metadata mirror.

7. **Help topics + Tests**
   - Topic‑aware `help` pages; Playwright smoke tests.

---

## 6) Acceptance Criteria (per milestone)

**Modular hardening**
- `>bm ls` works; autocomplete shows `bm`.
- Going **Back** clears and focuses the input.
- Theme CSS loads with forward slashes; no console errors. :contentReference[oaicite:10]{index=10}

**Bookmarks overlay**
- `bm add "X" https://… #Work` renders immediately; persists across reloads.
- `bm rm` removes overlay item or hides baseline item (if overlay missing).
- `bm mv/ren` update correctly; `bm sort #Group alpha` updates view; `bm sort apply` freezes order; `reset` restores default.
- `bm export/import` round-trips JSON.

**Sync**
- Server stores **only ciphertext**; write requires bearer; GET works without.
- `If-Match` prevents silent stomps; conflict path returns both versions; UI shows resolution.

**Scratchpad sync**
- `notes sync on` shows “synced” state; `pull/push` reliable; conflict modal appears if server version moves.

**Offline**
- With network disabled: page loads (SW), `offline use on` reads snapshot; edits queue; re‑enable network → queued writes flush.

---

## 7) PR Workflow

- Branch naming: `feature/<slug>`, `fix/<slug>`.
- Conventional Commits (`feat:`, `fix:`, `chore:`).
- Each PR:
  - ✅ Updated docs (README/HELP if user‑visible).
  - ✅ Smoke tests (add or update).
  - ✅ No selector churn (`#links`, `.links`, `#clocks`, `#scratch`).
  - ✅ No secrets; fragments (`#k`, `#w`) or storage for keys/tokens.
  - ✅ `_headers` unchanged unless explicitly requested.

Merge only after preview build (Cloudflare Pages) is green.

---

## 8) Security & Privacy

- **E2E**: Encrypt in browser; server never sees plaintext.
- **Bearer**: required for PUT only. Reads return ciphertext to everyone.
- **Sharing**:
  - Read‑only: `#k=<b64Key>`
  - Read+write: `#k=…&w=<writeToken>`
- **Storage**:
  - Show machines: store secrets in **session**.
  - Personal devices: **local** storage allowed.
- **No secrets** in query **params** or source control.

---

## 9) Testing Matrix (minimum)

- Input focus: load, navigate away and **Back**, `/` shortcut, **Esc** to clear.
- Routing: IP, URL, hostname (`.local/.lan`), shortcuts (`g`, `ddg`, `yt`, `r`, `hn`).
- Bookmarks: `bm ls/add/rm/mv/ren/sort/apply/reset/hide/unhide/export/import`.
- Profiles: `ls`, `cd <name>`; menu click.
- Clocks: `tz add/rm/ls`. Scratchpad: `note`, `cat notes`, `rm notes`.
- Caching: verify `_headers` via Network tab; JS revalidates; HTML/JSON no-store.
- (Sync) Envelope shape, PUT auth, conflict path.
- (Offline) SW cache, IDB snapshot, queued writes.

---

## 10) Naming & Copy

- User-facing terms: **groups** and **bookmarks** (bm).
- Headings visually as `// Title`.
- Help commands are topic‑aware (`help bm`, `help sync`, etc.).

---

## 11) Known Sharp Edges

- The legacy inline `index.html` script caused missing `bm` and hints; do not re‑add it. Use modular `main.js`. :contentReference[oaicite:11]{index=11}
- `main-themes/.../style.css` already styles links under `#links .links`; altering those selectors will break visuals. :contentReference[oaicite:12]{index=12}
- Keep Back‑button bfcache behavior: clear input before navigate; refocus on `pageshow`.

---

## 12) Definition of Done (DoD)

A feature is **done** when:
- Code + docs + tests updated,
- Preview build loads cleanly; no console errors,
- Commands autocompletion presents the new verbs,
- `_headers` served as specified,
- No breakage of theme styling (selectors unchanged),
- For sync: server stores ciphertext only; PUT guarded; conflicts handled.