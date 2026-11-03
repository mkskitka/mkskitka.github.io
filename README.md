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

## Deploy

The site is hosted on AWS at https://mkskitka.com: a private S3 bucket (`mk-skitka-site`)
served through CloudFront (distribution `E2L55K784TVBE6`, also reachable at
https://d2vfx0f1xojaxw.cloudfront.net). Deploys are run from this machine, because the
media in `src/assets` lives here. Nothing on GitHub deploys to AWS.
Project photos and videos go in `src/assets/projects/<slug>/` at any size; `npm run media`
(run by itself before `dev` and `build`) makes the web-sized copies in `src/assets/web/`
that the site ships (see `src/assets/projects/README.md`).

```bash
aws login        # once per session; the AWS CLI session expires after a while
git add -A
git commit -m "describe your change"
git push         # keep the repo in step with what is live
npm run deploy   # build + upload + CloudFront invalidation (scripts/deploy-aws.sh)
```

`npm run deploy` does, in order:

1. Rebuilds the resume HTML from `resume/resume.json` and exports `public/resume.pdf`
   (the "PDF ->" link on /resume). The PDF is not committed; it is remade every deploy.
2. `npm run build` into `dist/`.
3. Uploads `dist/assets` with a one-year immutable cache (Vite names those files after
   their contents), then everything else with a five-minute cache, and `index.html`
   with `no-cache`. Files no longer in `dist/` are deleted from the bucket.
4. Invalidates `/*` on CloudFront, so the new pages show within a minute or two.

It deploys the **working tree**, not the last commit, so uncommitted edits go live too.
If `aws` says the session has expired, run `aws login` and try again. To check what is
live, compare the bundle name in `dist/index.html` with the one in the page source at
https://mkskitka.com.

A copy is also published to GitHub Pages at https://mkskitka.github.io on every push to
`main` (`.github/workflows/deploy.yml`, about a minute). That is a side effect of pushing,
not the real site: a push alone does not update mkskitka.com.

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

To take a post off the site without archiving it on Instagram, run
`npm run visuals:review`: a page opens with each visual in turn and Keep / Remove
buttons (arrow keys work too). Decisions are saved as you go into
`src/data/visuals-review.json`; the site leaves out everything in its `hidden` list.
Commit that file and deploy. The sync never touches it, so removed posts stay removed;
picking Keep on one later puts it back.

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
6. **Actions → Sync Instagram visuals → Run workflow**. The tiles are live on
   GitHub Pages once the "Deploy to GitHub Pages" run that it kicks off finishes; to
   get them onto mkskitka.com, `git pull` and `npm run deploy` (see "Deploy").

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
