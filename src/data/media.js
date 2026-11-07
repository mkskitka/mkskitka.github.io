// Per-project photos and videos. Drop files into src/assets/projects/<slug>/ and
// they are picked up here at build time (see src/assets/projects/README.md).
//
// What the site actually ships are the web-sized copies in src/assets/web/<slug>/,
// made from the originals by scripts/media-web.mjs (`npm run media`, which also runs
// before dev and build): images become .webp, videos are re-encoded smaller, and each
// video gets a <name>-poster.webp frame. Names keep their stem, so `02.PNG` in a
// project folder is `02.webp` here, and a name from projects.js is matched by stem.

const files = import.meta.glob('../assets/web/*/*.{webp,gif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i
const VIDEO = /\.(mp4|webm)$/i
const HERO = /^hero(-poster)?\./i
const THUMB = /^thumb[.-]/i // thumb.*, thumb-poster.*, thumb-hover.* (never gallery items)
const POSTER = /-poster\.webp$/i // a video's poster frame, not a gallery image of its own

// { slug: { 'file.webp': '/assets/file-abc123.webp', ... } }
const bySlug = {}
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/web\/([^/]+)\/([^/]+)$/)
  if (!m) continue
  const [, slug, name] = m
  ;(bySlug[slug] ??= {})[name] = url
}
if (import.meta.env.DEV && Object.keys(bySlug).length === 0) {
  console.warn('[media] no web copies in src/assets/web/: run `npm run media` (needs the originals in src/assets/projects/)')
}

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
const stem = (name) => String(name).replace(/\.[^.]+$/, '')

/** All web copies for a project: { filename: url }. */
export const mediaFiles = (slug) => bySlug[slug] ?? {}

/** A file by its name in the project folder: exact first, then by stem (02.PNG -> 02.webp). */
function fileNamed(slug, name) {
  const f = mediaFiles(slug)
  if (f[name]) return name
  const want = stem(name).toLowerCase()
  const kind = VIDEO.test(name) ? VIDEO : IMAGE
  return Object.keys(f).find((n) => kind.test(n) && !POSTER.test(n) && stem(n).toLowerCase() === want)
}

/** Bare filename -> url from the project folder. Absolute paths / URLs pass through. */
export function resolveMedia(slug, name) {
  if (!name || name.startsWith('/') || /^https?:/i.test(name) || name.startsWith('data:')) return name
  const found = fileNamed(slug, name)
  const url = found ? mediaFiles(slug)[found] : undefined
  if (!url && import.meta.env.DEV) {
    console.warn(`[media] ${slug}: no file "${name}" in src/assets/projects/${slug}/ (or its web copy is missing: npm run media)`)
  }
  return url ?? name
}

/** True for a video file name or url (mp4 / webm). */
export const isVideo = (name) => VIDEO.test(String(name ?? '').split(/[?#]/)[0])

/** The poster frame made for a video (url), if there is one. */
export function posterFor(slug, name) {
  const found = fileNamed(slug, name)
  return found ? mediaFiles(slug)[`${stem(found)}-poster.webp`] : undefined
}

/** Photos, gifs and videos in the folder, in name order, with hero and thumb files left out. */
export function folderMedia(slug) {
  const f = mediaFiles(slug)
  return Object.keys(f)
    .filter((n) => (IMAGE.test(n) || VIDEO.test(n)) && !HERO.test(n) && !THUMB.test(n) && !POSTER.test(n))
    .sort(byName)
    .map((n) => ({ src: f[n], video: VIDEO.test(n), poster: VIDEO.test(n) ? f[`${stem(n)}-poster.webp`] : undefined }))
}

/** Photos in the folder, in name order, with hero files left out. */
export function folderImages(slug) {
  const f = mediaFiles(slug)
  return Object.keys(f)
    .filter((n) => IMAGE.test(n) && !HERO.test(n) && !THUMB.test(n) && !POSTER.test(n))
    .sort(byName)
    .map((n) => f[n])
}

/**
 * The hero backdrop for a project.
 *   hero.mp4 / hero.webm  -> { video: { mp4, webm, poster } }
 *   hero.jpg (etc.)       -> { still: url }
 *   nothing               -> {} (caller falls back to the site-wide hero video)
 * `override` is an explicit filename from projects.js and takes precedence.
 */
export function heroFor(slug, override) {
  const f = mediaFiles(slug)
  const names = Object.keys(f)
  const find = (re) => names.find((n) => re.test(n))

  let videoName = null
  let imageName = null
  if (override) {
    const name = fileNamed(slug, override) ?? override // 'hero.PNG' in projects.js -> hero.webp here
    if (VIDEO.test(name)) videoName = name
    else if (IMAGE.test(name)) imageName = name
    if (!f[name] && import.meta.env.DEV) {
      console.warn(`[media] ${slug}: hero "${override}" not found in src/assets/projects/${slug}/`)
    }
  }
  videoName ??= find(/^hero\.(mp4|webm)$/i)
  imageName ??= find(/^hero(-poster)?\.(png|jpe?g|webp|gif|avif)$/i)

  if (videoName && f[videoName]) {
    const mp4 = /\.mp4$/i.test(videoName) ? f[videoName] : f[find(/^hero\.mp4$/i)]
    const webm = /\.webm$/i.test(videoName) ? f[videoName] : f[find(/^hero\.webm$/i)]
    return { video: { mp4, webm, poster: f[imageName] } }
  }
  if (imageName && f[imageName]) return { still: f[imageName] }
  return {}
}

/**
 * The thumbnail for a project (its tile in the Systems grid on the home page).
 *   thumb.gif / .jpg / .png / ...  -> { image: url }
 *   thumb-hover.mp4 / .webm        -> adds hover: { mp4, webm, alpha }: a short clip the tile plays
 *                                     while the mouse is over it (scripts/thumb-hover.mjs cuts
 *                                     one from a video in the folder). `alpha`: the clip has
 *                                     a transparent background, made as a pair, VP9 .webm
 *                                     (Chrome, Firefox) + HEVC .mp4 (Safari), so the tile
 *                                     shows it as it is rather than blending its black away
 *   thumb.mp4 / thumb.webm         -> the same, with thumb.jpg (etc.) or the video's own
 *                                     poster frame as the still
 *   nothing                        -> null (caller falls back to the first showcase image)
 * `override` is an explicit filename from projects.js and takes precedence.
 */
export function thumbFor(slug, override) {
  const f = mediaFiles(slug)
  const names = Object.keys(f)
  const find = (re) => names.find((n) => re.test(n))

  let videoName = null
  let imageName = null
  if (override) {
    const name = fileNamed(slug, override) ?? override // 'thumb.PNG' in projects.js -> thumb.webp here
    if (VIDEO.test(name)) videoName = name
    else if (IMAGE.test(name)) imageName = name
    if (!f[name] && import.meta.env.DEV) {
      console.warn(`[media] ${slug}: thumb "${override}" not found in src/assets/projects/${slug}/`)
    }
  }
  videoName ??= find(/^thumb-hover\.(mp4|webm)$/i) ?? find(/^thumb\.(mp4|webm)$/i)
  imageName ??= find(/^thumb(-poster)?\.(png|jpe?g|webp|gif|avif)$/i)

  let hover = null
  if (videoName && f[videoName]) {
    const kind = /^thumb-hover\./i.test(videoName) ? 'thumb-hover' : 'thumb'
    hover = { mp4: f[`${kind}.mp4`], webm: f[`${kind}.webm`] }
    hover.alpha = !!(hover.mp4 && hover.webm) // a pair = made with transparency (see above)
    imageName ??= `${kind}-poster.webp` // no still of its own: the clip's poster frame
  }
  if (imageName && f[imageName]) return hover ? { image: f[imageName], hover } : { image: f[imageName] }
  return null
}
