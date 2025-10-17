# Startpage

A fast, minimal start page for live events and show ops. It’s a **static HTML** app that runs on **Cloudflare Pages**, using **ES modules** (no build step). Features include:

- **Profiles** (per show) with per–profile themes/timezones
- **Groups** of **bookmarks** (from baseline JSON), plus a plan for a **synced overlay** (KV + E2E)
- **Command bar** (search + shell‑style commands, autocomplete)
- **Clocks** (multi‑timezone, per profile)
- **Scratchpad** (local; optional sync)
- Optional **Timers** (local alarms)
- **Theme system** (variable‑only colorway CSS)

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
