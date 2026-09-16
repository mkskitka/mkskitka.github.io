// The "Systems" project list. Order matches the menu on the home page, and every
// project gets its own page at /projects/<slug>.
//
// Fill in `role`, `mediums`, `description`, and swap the placeholder `featured` images
// per project as you build them out.

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
//   tile(src, { width, aspect, top|bottom, left|right, rotate, alt, caption })
//
//   width   - e.g. '44vw' (viewport-relative so it scales with the window)
//   aspect  - '4 / 3', '3 / 4', '1', '16 / 9', '21 / 9' ...
//   top/bottom, left/right - position inside the 100vh x 100vw stage, e.g. top: '12vh'
//   rotate  - resting tilt in degrees
//
// The stage is one screen tall. Keep top + height inside ~95vh so nothing gets cut off
// (height = width x aspect, e.g. 44vw at 4/3 is 33vw tall). Phones ignore the layout and
// stack the images instead.
// ---------------------------------------------------------------------------
const tile = (name, opts) => ({ src: img(name), alt: '', ...opts })

// Placeholder images reused across projects until each gets its own.
const P1 = 'Screenshot-2026-01-27-195710.png'
const P2 = '792e4018-567c-4c81-8ff7-7bdc60260199.png'
const P3 = '67918fcc-529e-4688-bdbe-9d3cf7d131e8.png'
const P4 = 'Screenshot-2026-01-27-195937.png'

const details = { role: 'Visualist, Technologist', mediums: '', description: '' }

export const projects = [
  {
    slug: 'pgn-immersive-mobility-rehab',
    title: 'PGN - Immersive Mobility Rehab',
    heading: ['PGN', 'IMMERSIVE MOBILITY REHAB'],
    ...details,
    // Big anchor on the left, portrait top right, two smaller below.
    featured: [
      tile(P1, { width: '44vw', aspect: '4 / 3', top: '12vh', left: '5vw', rotate: -2 }),
      tile(P2, { width: '24vw', aspect: '3 / 4', top: '8vh', right: '7vw', rotate: 3 }),
      tile(P3, { width: '17vw', aspect: '1', bottom: '8vh', right: '9vw', rotate: -3 }),
      tile(P4, { width: '27vw', aspect: '16 / 10', bottom: '6vh', left: '35vw', rotate: 1.5 }),
    ],
  },
  {
    slug: 'realtor-savings-simulator',
    title: 'Realtor.com Savings Simulator',
    heading: ['REALTOR.COM', 'SAVINGS SIMULATOR'],
    ...details,
    // Two wide screens side by side, one small square tucked underneath.
    featured: [
      tile(P4, { width: '40vw', aspect: '16 / 9', top: '12vh', left: '4vw', rotate: -1.5 }),
      tile(P1, { width: '40vw', aspect: '16 / 9', top: '30vh', right: '4vw', rotate: 2 }),
      tile(P3, { width: '16vw', aspect: '1', bottom: '7vh', left: '28vw', rotate: -4 }),
    ],
  },
  {
    slug: 'audible-popup-visualizer',
    title: 'Audible Popup Visualizer',
    heading: ['AUDIBLE', 'POPUP VISUALIZER'],
    ...details,
    // Four tall portrait panels, staggered like a row of screens.
    featured: [
      tile(P2, { width: '21vw', aspect: '3 / 4', top: '10vh', left: '5vw', rotate: -3 }),
      tile(P1, { width: '21vw', aspect: '3 / 4', top: '22vh', left: '29vw', rotate: 2 }),
      tile(P4, { width: '21vw', aspect: '3 / 4', top: '8vh', left: '53vw', rotate: -2 }),
      tile(P3, { width: '21vw', aspect: '3 / 4', top: '24vh', right: '4vw', rotate: 3 }),
    ],
  },
  {
    slug: 'intel-the-light-keeper',
    title: 'INTEL - The Light Keeper',
    heading: ['INTEL x SMOOTH TECH', 'THE LIGHT KEEPER'],
    ...details,
    // One large centered hero image with three small satellites.
    featured: [
      tile(P1, { width: '50vw', aspect: '16 / 9', top: '14vh', left: '25vw', rotate: 0 }),
      tile(P3, { width: '15vw', aspect: '1', top: '10vh', left: '5vw', rotate: -5 }),
      tile(P2, { width: '15vw', aspect: '4 / 5', bottom: '10vh', right: '5vw', rotate: 4 }),
      tile(P4, { width: '20vw', aspect: '16 / 10', bottom: '6vh', left: '8vw', rotate: 2 }),
    ],
  },
  {
    slug: 'blueberry-swamp-festival',
    title: 'Blueberry Swamp Festival',
    heading: ['BLUEBERRY', 'SWAMP FESTIVAL'],
    ...details,
    // Diagonal cascade from top left to bottom right.
    featured: [
      tile(P3, { width: '30vw', aspect: '4 / 3', top: '8vh', left: '4vw', rotate: -4 }),
      tile(P4, { width: '26vw', aspect: '4 / 3', top: '30vh', left: '30vw', rotate: 3 }),
      tile(P2, { width: '24vw', aspect: '4 / 3', top: '50vh', left: '54vw', rotate: -2 }),
      tile(P1, { width: '18vw', aspect: '1', top: '10vh', right: '4vw', rotate: 5 }),
    ],
  },
  {
    slug: '370-botanic-gardens',
    title: '370 BOTANIC GARDENS',
    heading: ['370', 'BOTANIC GARDENS'],
    ...details,
    // One huge panoramic strip with two squares below.
    featured: [
      tile(P4, { width: '70vw', aspect: '21 / 9', top: '14vh', left: '15vw', rotate: -1 }),
      tile(P2, { width: '18vw', aspect: '1', bottom: '8vh', left: '6vw', rotate: 4 }),
      tile(P3, { width: '18vw', aspect: '1', bottom: '8vh', right: '6vw', rotate: -4 }),
    ],
  },
  {
    slug: 'venice-biennale-24',
    title: "'24 VENICE BIENALE",
    heading: ["'24", 'VENICE BIENALE'],
    ...details,
    // Two portraits facing each other, one wide image bridging them below.
    featured: [
      tile(P2, { width: '26vw', aspect: '3 / 4', top: '8vh', left: '8vw', rotate: -2 }),
      tile(P3, { width: '26vw', aspect: '3 / 4', top: '12vh', right: '8vw', rotate: 2 }),
      tile(P1, { width: '30vw', aspect: '16 / 9', bottom: '6vh', left: '35vw', rotate: 1 }),
    ],
  },
  {
    slug: 'evidence-71-the-shed',
    title: 'EVIDENCE 71@ The Shed',
    heading: ['EVIDENCE 71', '@ THE SHED'],
    ...details,
    // Overlapping squares stepping down, plus one up in the corner.
    featured: [
      tile(P1, { width: '26vw', aspect: '1', top: '10vh', left: '6vw', rotate: -3 }),
      tile(P4, { width: '26vw', aspect: '1', top: '24vh', left: '28vw', rotate: 2 }),
      tile(P2, { width: '26vw', aspect: '1', top: '38vh', left: '50vw', rotate: -2 }),
      tile(P3, { width: '20vw', aspect: '1', top: '8vh', right: '4vw', rotate: 4 }),
    ],
  },
]

export const getProject = (slug) => projects.find((p) => p.slug === slug)
