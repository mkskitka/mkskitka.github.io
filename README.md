# MK Skitka — portfolio site

React port of the Webflow site (`mk-skitka.webflow.zip`, exported 7 Sep 2026). No Webflow
runtime, no jQuery: the pages are React components, the interactions are plain GSAP.

## Run it

```bash
npm install     # first time only
npm run dev     # local dev server with hot reload (prints a localhost URL)
npm run build   # production build into dist/
npm run preview # serve the production build locally
```

Hosted on GitHub Pages at https://mkskitka.github.io from the `mkskitka.github.io` repo.
Every push to `main` rebuilds and redeploys automatically (see `.github/workflows/deploy.yml`);
it takes about a minute. To publish changes:

```bash
git add -A
git commit -m "describe your change"
git push
```

## Current state

Only the hero page is live. It is a three.js grid + ink-simulation backdrop
(`src/components/GridInkBackdrop.jsx`, all knobs in its `SETTINGS` block) with the
menu panel aligned to the grid. The rest of the site is kept for reference:

| Kept for reference | Where |
| --- | --- |
| Previous full home page (intro, Systems wheel, contact) | `src/pages/Home.full.jsx` |
| Project pages and collage | `src/pages/Project.jsx`, `src/components/Showcase.jsx` |
| Systems wheel, contact section, footer | `src/components/` |
| Project data, contact links, media | `src/data/` |

To bring a part back, re-add its route in `src/App.jsx` or its section in `Home.jsx`.

## Working with multiple agents (git worktrees)

Each agent (or person) works in its own worktree: a separate checkout of the repo
on its own branch, so edits never collide. The main checkout stays the integration
point.

```bash
scripts/worktree.sh ink-tuning        # creates ../mk-skitka-site.worktrees/ink-tuning on branch wt/ink-tuning
cd ../mk-skitka-site.worktrees/ink-tuning
claude                                # start an agent there
npm run dev -- --port 5181            # its own dev server (the script prints the port)
```

When a worktree's work is done, from the main checkout:

```bash
git merge wt/ink-tuning               # bring it into main
scripts/worktree.sh ink-tuning --remove
```

`scripts/worktree.sh --list` shows all worktrees. Commit in a worktree before
merging; uncommitted changes stay in that worktree only.

## Instagram visuals

The VISUALS tiles on the home page come straight from Instagram. A workflow
(`.github/workflows/instagram-sync.yml`) runs every day: it fetches the newest
posts, crops each one to a square in `public/images/instagram/`, writes
`src/data/instagram.json`, commits, and redeploys. Post or archive on Instagram
and the site follows within a day. Nothing to edit here.

One-time setup. The Instagram account must be a Business (or Creator) account
linked to a Facebook Page (Instagram app: Settings → Business tools and
controls → Linked accounts → Facebook).

1. https://developers.facebook.com/apps → **Create App**: use case **Other**,
   type **Business**, any name. In the dashboard add the **Instagram** product.
2. Open https://developers.facebook.com/tools/explorer, pick the app in the
   **Meta App** dropdown. Under **Permissions** add `pages_show_list`,
   `pages_read_engagement`, `instagram_basic`. Click **Generate Access Token**,
   log in, and tick the Page and the Instagram account when asked.
3. Copy the token from the explorer and make it long-lived: paste it at
   https://developers.facebook.com/tools/debug/accesstoken → **Debug** →
   **Extend Access Token** → copy the extended token.
4. Turn it into a Page token that never expires, from this folder:
   `INSTAGRAM_ACCESS_TOKEN=<extended token> node scripts/instagram-sync.mjs --page-token`
   It prints the Page token.
5. GitHub repo → **Settings → Secrets and variables → Actions → New repository
   secret**: name `INSTAGRAM_ACCESS_TOKEN`, value = the Page token.
6. **Actions → Sync Instagram visuals → Run workflow**. The tiles are live once
   the "Deploy to GitHub Pages" run that it kicks off finishes.

Run it locally to check: `INSTAGRAM_ACCESS_TOKEN=... node scripts/instagram-sync.mjs`
(every post is kept by default; `INSTAGRAM_MAX=24` limits it to the newest 24).

## Where things live

| Path | What |
| --- | --- |
| `src/pages/Home.jsx` | Home page: hero + menu, intro, Systems project list, Contact |
| `src/pages/Project.jsx` | Project detail page (was `home-copy.html`): hero, role/mediums/description, showcase collage |
| `src/data/projects.js` | **Edit this to add/rename projects, pick the 3-4 showcase images, fill in project details** |
| `src/data/videos.js` | Paths to the background video renditions |
| `src/data/contact.js` | Instagram / email / GitHub links for the Contact section |
| `src/components/` | `BackgroundVideo`, `HeroBackdrop`, `GridInkBackdrop` (three.js grid + ink simulation behind the home hero; all knobs in its `SETTINGS` block), `SystemsMenu`, `Showcase` (scroll collage), `ContactSection`, `SiteFooter` (unused for now), `ScrollToTop` |
| `src/lib/animations.js` | GSAP re-implementation of the Webflow scroll reveals |
| `src/styles/site.css` | The untouched Webflow stylesheet (design tokens, classes). Large; prune later if you like |
| `src/styles/webflow.css`, `normalize.css` | Webflow's base/component CSS, kept as-is |
| `src/styles/custom.css` | **Your CSS goes here** (card hover, showcase styling) |
| `public/images`, `public/videos` | Assets, referenced as `/images/...` and `/videos/...` |

## Routes

- `/` — home
- `/projects/<slug>` — one page per project in `src/data/projects.js`, each with its own
  showcase layout (image sizes/positions live in the project's `featured` list)

## Notes on the conversion

- Fonts (Open Sans, Bebas Neue) load from Google Fonts via `index.html`.
- Webflow's `webflow.js` + `jquery` are gone. Its IX3 interactions (word-by-word reveal
  of headings on scroll, slide-up of blocks) are in `animations.js`. The Webflow gallery
  was replaced by `Showcase.jsx`, a scroll-pinned collage of 3-4 images. Everything
  honors `prefers-reduced-motion`.
- The raw video masters (`hope_wide-1-1.mp4`, `1.mov`, `22.mov`) were not copied; only the
  renditions the pages use. They are still in the Webflow zip if you need them.
