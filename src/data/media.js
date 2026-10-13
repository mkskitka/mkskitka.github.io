// Per-project photos and videos. Drop files into src/assets/projects/<slug>/ and
// they are picked up here at build time (see src/assets/projects/README.md).

const files = import.meta.glob('../assets/projects/*/*.{png,jpg,jpeg,webp,gif,avif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i
const VIDEO = /\.(mp4|webm)$/i
const HERO = /^hero(-poster)?\./i
const THUMB = /^thumb(-poster)?\./i

// { slug: { 'file.jpg': '/assets/file-abc123.jpg', ... } }
const bySlug = {}
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/projects\/([^/]+)\/([^/]+)$/)
  if (!m) continue
  const [, slug, name] = m
  ;(bySlug[slug] ??= {})[name] = url
}

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

/** All files in a project's folder: { filename: url }. */
export const mediaFiles = (slug) => bySlug[slug] ?? {}

/** Bare filename -> url from the project folder. Absolute paths / URLs pass through. */
export function resolveMedia(slug, name) {
  if (!name || name.startsWith('/') || /^https?:/i.test(name) || name.startsWith('data:')) return name
  const url = mediaFiles(slug)[name]
  if (!url && import.meta.env.DEV) {
    console.warn(`[media] ${slug}: no file "${name}" in src/assets/projects/${slug}/`)
  }
  return url ?? name
}

/** Photos in the folder, in name order, with hero files left out. */
export function folderImages(slug) {
  const f = mediaFiles(slug)
  return Object.keys(f)
    .filter((n) => IMAGE.test(n) && !HERO.test(n) && !THUMB.test(n))
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
    if (VIDEO.test(override)) videoName = override
    else if (IMAGE.test(override)) imageName = override
    if (!f[override] && import.meta.env.DEV) {
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
 *   thumb.mp4 / thumb.webm         -> { video: { mp4, webm, poster } }  (poster: thumb.jpg etc. if present)
 *   thumb.gif / .jpg / .png / ...  -> { image: url }
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
    if (VIDEO.test(override)) videoName = override
    else if (IMAGE.test(override)) imageName = override
    if (!f[override] && import.meta.env.DEV) {
      console.warn(`[media] ${slug}: thumb "${override}" not found in src/assets/projects/${slug}/`)
    }
  }
  videoName ??= find(/^thumb\.(mp4|webm)$/i)
  imageName ??= find(/^thumb(-poster)?\.(png|jpe?g|webp|gif|avif)$/i)

  if (videoName && f[videoName]) {
    const mp4 = /\.mp4$/i.test(videoName) ? f[videoName] : f[find(/^thumb\.mp4$/i)]
    const webm = /\.webm$/i.test(videoName) ? f[videoName] : f[find(/^thumb\.webm$/i)]
    return { video: { mp4, webm, poster: f[imageName] } }
  }
  if (imageName && f[imageName]) return { image: f[imageName] }
  return null
}
