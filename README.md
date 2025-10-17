# Startpage

A fast, minimal start page for live events and show ops. It’s a **static HTML** app that runs on **Cloudflare Pages**, using **ES modules** (no build step). Features include:

- **Profiles** (per show) with per–profile themes/timezones
- **Groups** of **bookmarks** (from baseline JSON), plus a plan for a **synced overlay** (KV + E2E)
- **Command bar** (search + shell‑style commands, autocomplete)
- **Clocks** (multi‑timezone, per profile)
- **Scratchpad** (local; optional sync)
- Optional **Timers** (local alarms)
- **Theme system** (variable‑only colorway CSS)

### Bookmark commands

The `bm` command family manages a local overlay of bookmarks:

- `bm add "Label" <url> [#Group]` adds a bookmark (defaulting to the first visible group).
- `bm rm <label|#n>` removes overlay bookmarks or hides baseline entries.
- `bm mv "Label" #Group` moves a bookmark; `bm ren "Old" "New"` renames it.
- `bm hide "Label"` / `bm unhide "Label"` toggle visibility.
- `bm sort insertion|alpha|smart`, `bm sort #Group …`, `bm sort apply`, and `bm sort reset` control ordering, while `groups sort …` applies to group headings.
- `bm export` / `bm import` round-trip the overlay JSON for backup or sharing.

> The DOM keeps the classic hooks: links render inside `#links` with `.links` sections; clocks under `#clocks`; scratchpad uses `#scratch`. Your theme CSS already targets those selectors, so keep them stable. :contentReference[oaicite:2]{index=2}

---

## Quick start

### Local dev (zero build)

You must serve files over HTTP for `fetch()` and module imports to work:

```bash
# Option A: Python
python3 -m http.server 8000

# Option B: Node
npx http-server -p 8000
# or
npx serve -l 8000
```

### Tooling & tests

Install dev dependencies (ESLint, Prettier, optional Playwright) and run checks:

```bash
npm install
npm run lint        # ESLint over assets/js
npm run format      # Prettier check for JS/HTML/CSS/JSON/MD
npm test            # Node-based unit checks (parseDuration)
# npm run test:playwright  # Stubbed smoke suite (requires @playwright/test)
```

> Playwright stays optional so the workflow keeps a light footprint, but the
> provided devcontainer now supports installing it directly. Run
> `npm install @playwright/test` and `npx playwright install` when you are ready
> to flesh out the smoke suite.

### Cache rules

Cloudflare Pages `_headers` already enforces the expected policies: HTML/JSON
responses use `no-store`, JS modules `must-revalidate`, and CSS/theme assets are
served with `immutable`. Bump the script `?v=` parameter in `index.html` if you
need to bust caches during development.
