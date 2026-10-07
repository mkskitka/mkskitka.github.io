// The "Systems" project list. Order matches the menu on the home page, and every
// project gets its own page at /projects/<slug>.
//
// Photos and videos for each project go in src/assets/projects/<slug>/ (see the
// README there). A file named hero.jpg / hero.mp4 becomes that project's hero
// backdrop, or set `hero: 'file.jpg'` here to pick one by name.
//
// Fill in `role`, `mediums`, `description`, and swap the placeholder `featured` images
// per project as you build them out. Delete a project's `featured` list to have the
// first four photos in its folder laid out automatically.
//
// Thumbnail (the tile in the Systems grid on the home page): a file named
// thumb.jpg / thumb.gif / thumb.mp4 in the project's folder, or set
// `thumb: 'file.gif'` here to pick one by name. With neither, the first showcase
// image is used.

import { folderImages, heroFor, resolveMedia, thumbFor } from './media.js'

const img = (name) => `/images/${name}`

// Every image from the Webflow export, for picking from (public/images).
export const allImages = [
  'Screenshot-2026-01-23-122025.png', '7d2c2c1c-1bf4-4191-9bfe-eea6d6ddd7da.png',
  '792e4018-567c-4c81-8ff7-7bdc60260199.png', '06d01b61-ecd4-4552-afdd-4e6cd890ae36.png',
  '6f87f21f-79e7-44bf-850d-00f9462588ca.png', '67918fcc-529e-4688-bdbe-9d3cf7d131e8.png',
  '558e3f5c-c8fa-4baf-8b68-56791c0dbb15.png', 'Screenshot-2026-01-27-195524.png',
  'Screenshot-2026-01-27-195545.png', 'Screenshot-2026-01-27-195338.png',
  'Screenshot-2026-01-27-195431.png', 'Screenshot-2026-01-27-195345.png',
  'Screenshot-2026-01-27-195937.png', '2.png', 'Screenshot-2026-01-27-195927.png',
  'Screenshot-2026-01-27-195903.png', 'Screenshot-2026-01-27-195917.png',
  'Screenshot-2026-01-27-195407.png', 'Screenshot-2026-01-27-195710.png',
  'Screenshot-2026-01-27-195818.png', 'Screenshot-2026-01-27-195811.png',
  'Screenshot-2026-01-27-195800.png', 'Screenshot-2026-01-27-195745.png',
  'Screenshot-2026-01-27-195736.png', 'Screenshot-2026-01-27-195728.png',
  'Screenshot-2026-01-27-195850.png', 'Screenshot-2026-01-27-195501.png',
  'Screenshot-2026-01-27-195444.png', 'Screenshot-2025-06-17-120400.png',
  'Screenshot-2026-01-27-195650.png', 'Screenshot-2025-06-16-214953.png',
  'Screenshot-2026-01-27-195614.png',
].map(img)

// ---------------------------------------------------------------------------
// Showcase images. Each project page shows 3-4 images in a scroll-driven collage;
// every image carries its own size and position, so each page can look different.
//
//   tile(src, { width, aspect, top|bottom, left|right, alt, caption })
//
//   src     - a bare filename from the project's folder ('01.jpg'), or a '/images/...'
//             path into public/
//   width   - e.g. '44vw' (viewport-relative so it scales with the window)
//   aspect  - '4 / 3', '3 / 4', '1', '16 / 9', '21 / 9' ...
//   top/bottom, left/right - position inside the 100vh x 100vw stage, e.g. top: '12vh'
//
// The stage is one screen tall. Keep top + height inside ~95vh so nothing gets cut off
// (height = width x aspect, e.g. 44vw at 4/3 is 33vw tall). Phones ignore the layout and
// stack the images instead.
// ---------------------------------------------------------------------------
const tile = (name, opts) => ({ src: name, alt: '', ...opts })

// Placeholder images (public/images) reused across projects until each gets its own.
const P1 = img('Screenshot-2026-01-27-195710.png')
const P2 = img('792e4018-567c-4c81-8ff7-7bdc60260199.png')
const P3 = img('67918fcc-529e-4688-bdbe-9d3cf7d131e8.png')
const P4 = img('Screenshot-2026-01-27-195937.png')

// Default layouts used when a project has no `featured` list, by photo count.
const AUTO_LAYOUTS = {
  1: [{ width: '72vw', aspect: '16 / 9', top: '10vh', left: '14vw' }],
  2: [
    { width: '46vw', aspect: '16 / 9', top: '8vh', left: '4vw' },
    { width: '46vw', aspect: '16 / 9', top: '42vh', right: '4vw' },
  ],
  3: [
    { width: '92vw', aspect: '4 / 1', top: '4vh', left: '4vw' },
    { width: '45vw', aspect: '2 / 1', top: '52vh', left: '4vw' },
    { width: '45vw', aspect: '2 / 1', top: '52vh', right: '4vw' },
  ],
  4: [
    { width: '50vw', aspect: '16 / 9', top: '4vh', left: '4vw' },
    { width: '50vw', aspect: '13 / 5', top: '58vh', left: '4vw' },
    { width: '40vw', aspect: '16 / 9', top: '4vh', right: '4vw' },
    { width: '40vw', aspect: '16 / 9', top: '50vh', right: '4vw' },
  ],
}

const details = { role: 'Visualist, Technologist', mediums: '', description: '' }

const projectList = [
  {
    slug: 'pgn-immersive-mobility-rehab',
    title: 'PGN - Immersive Mobility Rehab',
    heading: ['PGN', 'IMMERSIVE MOBILITY REHAB'],
    ...details,
    // Two columns: big screen + wide strip on the left, two wide frames stacked right.
    featured: [
      tile(P1, { width: '50vw', aspect: '16 / 9', top: '4vh', left: '4vw' }),
      tile(P4, { width: '50vw', aspect: '13 / 5', top: '58vh', left: '4vw' }),
      tile(P2, { width: '40vw', aspect: '16 / 9', top: '4vh', right: '4vw' }),
      tile(P3, { width: '40vw', aspect: '16 / 9', top: '50vh', right: '4vw' }),
    ],
  },
  {
    slug: 'realtor-savings-simulator',
    title: 'Realtor.com Savings Simulator',
    heading: ['REALTOR.COM', 'SAVINGS SIMULATOR'],
    ...details,
    // Full-width strip on top, two wide screens side by side below.
    featured: [
      tile(P4, { width: '92vw', aspect: '4 / 1', top: '4vh', left: '4vw' }),
      tile(P1, { width: '45vw', aspect: '2 / 1', top: '52vh', left: '4vw' }),
      tile(P3, { width: '45vw', aspect: '2 / 1', top: '52vh', right: '4vw' }),
    ],
  },
  {
    slug: 'audible-popup-visualizer',
    title: 'Audible Popup Visualizer',
    heading: ['AUDIBLE', 'POPUP VISUALIZER'],
    ...details,
    // Tall portrait on the left, big screen top right, two short strips under it.
    featured: [
      tile(P2, { width: '30vw', aspect: '3 / 4', top: '4vh', left: '4vw' }),
      tile(P1, { width: '58vw', aspect: '16 / 9', top: '6vh', right: '4vw' }),
      tile(P4, { width: '28vw', aspect: '2 / 1', top: '69vh', left: '38vw' }),
      tile(P3, { width: '26vw', aspect: '2 / 1', top: '69vh', right: '4vw' }),
    ],
  },
  {
    slug: 'intel-the-light-keeper',
    title: 'INTEL - The Light Keeper',
    heading: ['INTEL x SMOOTH TECH', 'THE LIGHT KEEPER'],
    ...details,
    // Big hero screen top left, tall portrait on the right, two strips along the bottom.
    featured: [
      tile(P1, { width: '60vw', aspect: '16 / 9', top: '4vh', left: '4vw' }),
      tile(P3, { width: '26vw', aspect: '3 / 4', top: '4vh', right: '4vw' }),
      tile(P2, { width: '28vw', aspect: '2 / 1', top: '68vh', left: '4vw' }),
      tile(P4, { width: '28vw', aspect: '2 / 1', top: '68vh', left: '36vw' }),
    ],
  },
  {
    slug: 'blueberry-swamp-festival',
    title: 'Blueberry Swamp Festival',
    heading: ['BLUEBERRY', 'SWAMP FESTIVAL'],
    ...details,
    // Two by two grid of wide frames, alternating tilt.
    featured: [
      tile(P3, { width: '46vw', aspect: '2 / 1', top: '4vh', left: '4vw' }),
      tile(P4, { width: '46vw', aspect: '2 / 1', top: '4vh', right: '2vw' }),
      tile(P2, { width: '46vw', aspect: '2 / 1', top: '51vh', left: '4vw' }),
      tile(P1, { width: '46vw', aspect: '2 / 1', top: '51vh', right: '2vw' }),
    ],
  },
  {
    slug: '370-botanic-gardens',
    title: '370 BOTANIC GARDENS',
    heading: ['370', 'BOTANIC GARDENS'],
    ...details,
    // Full-width panorama with two wide strips beneath.
    featured: [
      tile(P4, { width: '92vw', aspect: '3 / 1', top: '4vh', left: '4vw' }),
      tile(P2, { width: '45vw', aspect: '3 / 1', top: '63vh', left: '4vw' }),
      tile(P3, { width: '45vw', aspect: '3 / 1', top: '63vh', right: '4vw' }),
    ],
  },
  {
    slug: 'venice-biennale-24',
    title: "'24 VENICE BIENALE",
    heading: ["'24", 'VENICE BIENALE'],
    ...details,
    // Tall portrait on the left, big screen and a strip stacked on the right.
    featured: [
      tile(P2, { width: '30vw', aspect: '3 / 4', top: '4vh', left: '4vw' }),
      tile(P3, { width: '58vw', aspect: '16 / 9', top: '6vh', right: '4vw' }),
      tile(P1, { width: '58vw', aspect: '4 / 1', top: '69vh', right: '4vw' }),
    ],
  },
  {
    slug: 'evidence-71-the-shed',
    title: 'EVIDENCE 71@ The Shed',
    heading: ['EVIDENCE 71', '@ THE SHED'],
    ...details,
    // Offset two-column grid: tall frame + strip left, screen + strip right.
    featured: [
      tile(P1, { width: '44vw', aspect: '4 / 3', top: '4vh', left: '4vw' }),
      tile(P4, { width: '44vw', aspect: '16 / 9', top: '4vh', right: '4vw' }),
      tile(P2, { width: '44vw', aspect: '3 / 1', top: '52vh', right: '4vw' }),
      tile(P3, { width: '44vw', aspect: '3 / 1', top: '67vh', left: '4vw' }),
    ],
  },
]

// Resolve folder files: bare tile names -> urls, hero.* -> hero backdrop, and an
// automatic layout for projects that have photos in their folder but no `featured`.
export const projects = projectList.map((p) => {
  let featured = p.featured
  if (!featured) {
    const photos = folderImages(p.slug).slice(0, 4)
    const layout = AUTO_LAYOUTS[photos.length]
    featured = layout ? photos.map((src, i) => ({ src, alt: '', ...layout[i] })) : []
  }
  featured = featured.map((t) => ({ ...t, src: resolveMedia(p.slug, t.src) }))
  return {
    ...p,
    hero: heroFor(p.slug, p.hero),
    featured,
    thumb: thumbFor(p.slug, p.thumb) ?? (featured[0] ? { image: featured[0].src } : null),
  }
})

export const getProject = (slug) => projects.find((p) => p.slug === slug)
