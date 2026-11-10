// Visuals: generative pieces. Shown as scattered tiles when VISUALS is selected on
// the home page; a tile expands its image to fill the page, like a project tile.
//
// The tiles come from Instagram automatically: scripts/instagram-sync.mjs (run
// daily by .github/workflows/instagram-sync.yml) fetches the newest posts, crops
// them square into public/images/instagram/, and writes instagram.json. Post or
// archive on Instagram and the site follows within a day. See README
// "Instagram visuals" for the one-time setup.
//
// Each entry: `image` is the thumbnail and the full-page image, `title` is the
// panel title when it is open, `url` (the Instagram post) is kept for a future
// link-out. Until the first sync has run, the placeholders below are shown instead.
// To take a post off the site without archiving it on Instagram: npm run
// visuals:review (scripts/visuals-review.mjs).
import instagram from './instagram.json'
import review from './visuals-review.json'
import tags from './visuals-tags.json'

const placeholders = [
  { id: 'gem-vertahorizlines', title: 'gem vertahorizlines', url: 'https://www.instagram.com/rgb__tears/', image: '/images/Screenshot-2026-01-27-195710.png' },
  { id: 'visual-2', title: 'Visual 02', url: 'https://www.instagram.com/rgb__tears/', image: '/images/Screenshot-2026-01-27-195937.png' },
  { id: 'visual-3', title: 'Visual 03', url: 'https://www.instagram.com/rgb__tears/', image: '/images/792e4018-567c-4c81-8ff7-7bdc60260199.png' },
  { id: 'visual-4', title: 'Visual 04', url: 'https://www.instagram.com/rgb__tears/', image: '/images/67918fcc-529e-4688-bdbe-9d3cf7d131e8.png' },
  { id: 'visual-5', title: 'Visual 05', url: 'https://www.instagram.com/rgb__tears/', image: '/images/Screenshot-2026-01-27-195524.png' },
  { id: 'visual-6', title: 'Visual 06', url: 'https://www.instagram.com/rgb__tears/', image: '/images/Screenshot-2026-01-27-195818.png' },
  { id: 'visual-7', title: 'Visual 07', url: 'https://www.instagram.com/rgb__tears/', image: '/images/Screenshot-2026-01-27-195850.png' },
  { id: 'visual-8', title: 'Visual 08', url: 'https://www.instagram.com/rgb__tears/', image: '/images/558e3f5c-c8fa-4baf-8b68-56791c0dbb15.png' },
]

// Posts taken off the site in the review tool (npm run visuals:review) are listed in
// visuals-review.json as `hidden`; the sync never touches that file.
const hidden = new Set(review.hidden ?? [])
// Each post's tags ('text', 'ai', 'generative': the Show dropdown's subsets, listed in
// src/lib/sortItems.js), by post id in visuals-tags.json. Kept apart from
// instagram.json and visuals-review.json because the sync and the review tool
// rewrite those. A post that is not listed carries no tags (shown under All only).
export const visuals = (instagram.length ? instagram : placeholders)
  .filter((v) => !hidden.has(v.id))
  .map((v) => (tags[v.id] ? { ...v, tags: tags[v.id] } : v))
