# Startpage

Static start page with:
- theme switching,
- command/shortcut search,
- clocks,
- local scratchpad,
- dynamic links via `links.json`.

## Local preview
Use a simple static server so `fetch("./links.json")` works:
- VS Code Live Server, or
- `python -m http.server` (Python 3), then open http://localhost:8000

## Update links
Edit `links.json` and commit. Cloudflare Pages deploy will pick it up immediately (we send `Cache-Control: no-cache` for this file).

## Deploy to Cloudflare Pages
1. Push this repo to GitHub.
2. Cloudflare Dashboard → Pages → Create Project → Connect to Git.
3. Framework preset: **None**.
4. Build command: *(leave blank)*.
5. Output directory: **/**.
6. Save and deploy.
