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

import { folderImages, folderMedia, heroFor, isVideo, resolveMedia, thumbFor } from './media.js'

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

// `date` is free text shown in the write-up (e.g. '2024', 'Spring 2023', 'Oct 2022').
// `gallery` (optional) is the list of photos for the Gallery row in the write-up:
//   gallery: [{ src: 'photo1.jpg' }, { src: 'photo2.jpg', alt: 'Caption' }]
// Bare file names resolve from the project's folder in src/assets/projects/<slug>/,
// or use a full path like '/images/x.png'. Without it, the first four photos in the
// folder are used (any names, sorted; hero.* and thumb.* skipped); an empty folder shows no gallery.
// `role`, `mediums` and `description` are the rest of the write-up, set on each project
// below. A blank `mediums` leaves that row out; an empty `description` shows the
// "coming soon" placeholder.

// To take a project off the site until it is ready, add `hidden: true` to its entry
// below. Everything about it (folder, images, text) stays in place; it just is not
// listed or reachable. Remove the flag to bring it back.

// To lock a project behind a password, add `lock: '<code>'` to its entry, where the
// code comes from running  node scripts/lock-password.mjs "the password"  in the
// terminal (the password itself is never written here). The tile shows a padlock and
// asks for the password before opening. Remove the line to unlock it for everyone.
// This keeps casual visitors out; the project's files are still in the published site.
const projectList = [
  {
    slug: 'pgn-immersive-mobility-rehab',
    date: '2025', // placeholder, update
    title: 'PGN - Immersive Mobility Rehab',
    heading: ['PGN', 'IMMERSIVE MOBILITY REHAB'],
    role: 'Visualist, Technologist',
    mediums: 'TouchDesigner, Orbbec, MediaPipe, body tracking, eye tracking, LED walls, projection, lidar',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      'PGN is a multi-room interactive therapy system for physical, cognitive and vision rehabilitation, built for personalized health care and installed at multiple locations. Each site combines an interactive LED hallway, a full-body projection motion room and an ambient multi-sensory recharge room.',
      'All three rooms run on a single TouchDesigner core. A config file on each machine decides which room it is, and which sensors, displays and experiences come up on boot, so the same system can be deployed to very different spaces. Markerless motion capture, depth cameras, lidar and camera-based body and eye tracking are all smoothed into one common set of player data, so every experience works the same way no matter which sensor is feeding it.',
      'At the centre is a target-based therapy game. Clinicians run sessions from a control panel, levels are written as simple config files, and a GPU particle system moves the targets in a way that is fully repeatable, so a session can be paused, resumed, replayed and compared over time. Movement and hit data are recorded throughout for later analysis.',
      'I worked across the whole project: system architecture, sensor integration and calibration, the target and level system, real-time visuals and shaders, communication with the control panel, session recording, and on-site installation and commissioning.',
    ],
    // Password protected: see "To lock a project" above.
    lock: '9e456f26807c93ec5a495efd82c1938addaa115ab37f624d6af5e7cd212ece3a',
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
    date: '2026', // placeholder, update
    title: 'Realtor.com Savings Simulator',
    heading: ['REALTOR.COM', 'SAVINGS SIMULATOR'],
    role: 'Visualist, Technologist',
    mediums: 'Unity, Gemini, ChatGPT, Claude, Midjourney, image and video generation',
    description: 'I worked with a graphic designer to produce 16-bit style game graphics for an arcade savings simulator game at SXSW (South by Southwest).',
    // Full-width strip on top, two wide screens side by side below.
    featured: [
      tile(P4, { width: '92vw', aspect: '4 / 1', top: '4vh', left: '4vw' }),
      tile(P1, { width: '45vw', aspect: '2 / 1', top: '52vh', left: '4vw' }),
      tile(P3, { width: '45vw', aspect: '2 / 1', top: '52vh', right: '4vw' }),
    ],
  },
  {
    slug: 'audible-popup-visualizer',
    date: '2024', // placeholder, update
    title: 'Audible Story House',
    heading: ['AUDIBLE', 'STORY HOUSE VISUALIZER'],
    role: 'Visualist, Technologist',
    mediums: 'TouchDesigner, Audio Reactive, Projection',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      'Audible Story House was a month-long pop-up where visitors could listen to audiobooks, with a dedicated listening room in the back. I built the audio-reactive visualizer that played in that room for the length of the pop-up.',
      "The visuals evolved over the course of the day and responded to the voices and sounds of whatever was playing. Alongside the visualizer, I built a web interface that Audible's brand ambassadors used to further customize the audio-visual experience.",
    ],
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
    date: '2023', // placeholder, update
    title: 'INTEL - The Light Keeper',
    heading: ['INTEL x SMOOTH TECH', 'THE LIGHT KEEPER'],
    role: 'Visualist, Technologist',
    mediums: 'LED wall, TouchDesigner, Body Tracking',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: ["I built a real-time performance that reacted to dancers' body movement at Intel's pop-up in Times Square."],
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
    hidden: 'true',
    date: '2025', // placeholder, update
    title: 'Blueberry Swamp Festival',
    heading: ['BLUEBERRY', 'SWAMP FESTIVAL'],
    role: 'Visualist, Technologist',
    mediums: '',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [],
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
    date: '2024', // placeholder, update
    title: '370 BOTANIC GARDENS',
    heading: ['370', 'BOTANIC GARDENS'],
    role: 'Visualist, Technologist',
    mediums: 'Projection, Scrim, ComfyUI',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      "A personal exploration of materiality and AI.",
      "This installation at the Clive Davis Gallery, 370 Jay Street, MetroTech, was seeded from an initial interest in the mechanisms and aesthetics of AI-generated visuals and a desire to disprove tired judgements of the medium. It uses footage filmed from the perspective of a person looking out the gallery window, and generates video of flowers using a model trained on photos taken at the Brooklyn Botanic Garden in May 2024. I gravitated towards materials that created and came from physicality (painting of the scrim) and naturalness (natural light and scrim) to reframe my collaboration process with the AI algorithms.",
      "The piece is deeply intertwined with its environment, changing brightness and opacity in response to subtle changes in the lighting both in the gallery and out on the street. The installation can be viewed from outside and from inside the gallery.",
    ],
    // Full-width panorama with two wide strips beneath.
    featured: [
      tile(P4, { width: '92vw', aspect: '3 / 1', top: '4vh', left: '4vw' }),
      tile(P2, { width: '45vw', aspect: '3 / 1', top: '63vh', left: '4vw' }),
      tile(P3, { width: '45vw', aspect: '3 / 1', top: '63vh', right: '4vw' }),
    ],
  },
  {
    slug: 'venice-biennale-24',
    date: '2024', // placeholder, update
    title: "'24 VENICE BIENNALE",
    heading: ["'24", 'VENICE BIENNALE'],
    role: 'Visualist, Technologist',
    mediums: '',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      "Collaborating with Volvox Labs and artist Fatimah Tuggar, I worked on the design and development of a real-time generative AI video depicting imaginaries of the Calabash Gourd for the Creampods exhibit at the 2024 Venice Biennale. The generative video API produced days' worth of unique content for the exhibit.",
    ],
    // Tall portrait on the left, big screen and a strip stacked on the right.
    featured: [
      tile(P2, { width: '30vw', aspect: '3 / 4', top: '4vh', left: '4vw' }),
      tile(P3, { width: '58vw', aspect: '16 / 9', top: '6vh', right: '4vw' }),
      tile(P1, { width: '58vw', aspect: '4 / 1', top: '69vh', right: '4vw' }),
    ],
  },
  {
    slug: 'evidence-71-the-shed',
    date: '2023', // placeholder, update
    title: 'EVIDENCE 071 @ The Shed',
    heading: ['EVIDENCE 071', '@ THE SHED'],
    role: 'Visualist, Technologist',
    mediums: 'React, Web, Data Visualization',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      "Working with artist Lizania Cruz and co-developer Matt Ross, I developed and designed a touch-screen data visualization that acts as a digital archive of Lizania's ongoing research, displaying archival material and collecting museum-goers' thoughts on Frederick Douglass's involvement in US global affairs.",
      "This installation, along with the web application and data visualization, was on display as part of the Open Call 2023 group exhibition at The Shed, NYC.",
      "'Evidence 071: Frederick Douglass and The Commission of Inquiry is a multimedia installation, based on Cruz's research in the Dominican Republic, that explores the role of US imperialism and asks audiences to consider their relation to ongoing processes of colonization.'",
    ],
    // Offset two-column grid: tall frame + strip left, screen + strip right.
    featured: [
      tile(P1, { width: '44vw', aspect: '4 / 3', top: '4vh', left: '4vw' }),
      tile(P4, { width: '44vw', aspect: '16 / 9', top: '4vh', right: '4vw' }),
      tile(P2, { width: '44vw', aspect: '3 / 1', top: '52vh', right: '4vw' }),
      tile(P3, { width: '44vw', aspect: '3 / 1', top: '67vh', left: '4vw' }),
    ],
  },
  {
    // Files live in src/assets/projects/DE-Kiosk/ (the folder name is the slug):
    // thumb.jpg is the tile, hero.mp4 + hero.jpg the full-page backdrop, 01.jpg the gallery.
    slug: 'DE-Kiosk',
    date: '2025', // placeholder, update
    title: 'Drunk Elephant Kiosk',
    heading: ['DRUNK ELEPHANT', 'KIOSK'],
    role: 'Visualist, Technologist',
    mediums: 'TouchDesigner, React, Web, Data Visualization, Animation',
    // One string per paragraph: description: ['First paragraph.', 'Second paragraph.']
    description: [
      "I worked with Volvox Labs and Drunk Elephant to update the design of an immersive hair-care quiz kiosk. Users enter information about their hair type to receive a custom hair-care smoothie recommendation.",
      "The A/V setup includes a touch-screen web application running in tandem with overhead animated visuals. I contributed to upgrading the web animations and integration testing of the installation.",
    ],
  },
]

// Resolve folder files: bare tile names -> urls, hero.* -> hero backdrop, and an
// automatic layout for projects that have photos in their folder but no `featureid`.
export const projects = projectList.filter((p) => !p.hidden).map((p) => {
  let featured = p.featured
  if (!featured) {
    const photos = folderImages(p.slug).slice(0, 4)
    const layout = AUTO_LAYOUTS[photos.length]
    featured = layout ? photos.map((src, i) => ({ src, alt: '', ...layout[i] })) : []
  }
  featured = featured.map((t) => ({ ...t, src: resolveMedia(p.slug, t.src) }))
  // Gallery: an explicit `gallery` list wins; otherwise the first four photos, gifs or
  // videos in the project's folder (hero.* and thumb.* excluded, sorted by name).
  // An empty folder means no gallery. `video` marks mp4 / webm so the gallery plays them.
  const folder = folderMedia(p.slug)
  const gallery = p.gallery
    ? p.gallery.map((g) => ({ ...g, src: resolveMedia(p.slug, g.src), video: g.video ?? isVideo(g.src) }))
    : folder.length
      ? folder.slice(0, 4).map((m) => ({ ...m, alt: '' }))
      : undefined
  return {
    ...p,
    hero: heroFor(p.slug, p.hero),
    featured,
    gallery,
    thumb: thumbFor(p.slug, p.thumb) ?? (featured[0] ? { image: featured[0].src } : null),
  }
})

export const getProject = (slug) => projects.find((p) => p.slug === slug)
