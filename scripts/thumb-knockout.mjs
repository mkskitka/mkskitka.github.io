// Takes the black background out of a project's thumbnail, so the tile's glass shows
// there instead (src/data/projects.js `thumbGlass`). The original is kept beside it as
// thumb.source.<ext> (which the media script leaves alone) and thumb.png gets the
// transparent version; npm run media then makes the web copy from that.
//   node scripts/thumb-knockout.mjs <slug> edge [darkness]
//                                                 black joined to the picture's edge goes
//                                                 (a collage on black); dark areas inside
//                                                 the pictures stay. `darkness` (0-255,
//                                                 default 40) is how dark counts as
//                                                 background: lower it when the subject
//                                                 has near-black parts of its own
//   node scripts/thumb-knockout.mjs <slug> glow   brightness becomes opacity, like light on
//                                                 black (particles, glows): black goes,
//                                                 dim things go see-through
import { readdirSync, renameSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [slug, mode = 'edge', darkness = '40'] = process.argv.slice(2)
if (!slug || !['edge', 'glow'].includes(mode)) {
  console.error('usage: node scripts/thumb-knockout.mjs <slug> [edge|glow]')
  process.exit(1)
}
const dir = path.join(ROOT, 'src/assets/projects', slug)
const names = readdirSync(dir)
let src = names.find((n) => /^thumb\.source\./i.test(n)) // already knocked out once: start again from the original
if (!src) {
  const cur = names.find((n) => /^thumb\.(png|jpe?g|webp)$/i.test(n))
  if (!cur) throw new Error(`no thumb.png / thumb.jpg in ${dir}`)
  src = cur.replace(/^thumb\./i, 'thumb.source.')
  renameSync(path.join(dir, cur), path.join(dir, src))
}
const out = path.join(dir, 'thumb.png')

const { data, info } = await sharp(path.join(dir, src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const px = W * H
const bright = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
let removed = 0

if (mode === 'glow') {
  for (let i = 0; i < px; i++) {
    const a = bright(i)
    if (a === 0) removed++
    for (let c = 0; c < 3; c++) data[i * 4 + c] = a ? Math.min(255, Math.round((data[i * 4 + c] * 255) / a)) : 0
    data[i * 4 + 3] = a
  }
} else {
  // Flood from the border through near-black pixels; those become transparent, with
  // the very darkest fully so and the slightly lighter ones (anti-aliased edges of the
  // pictures) part way, so the pictures keep soft edges.
  const T = Math.max(1, Number(darkness) || 40)
  const seen = new Uint8Array(px)
  const stack = []
  const push = (i) => {
    if (!seen[i] && bright(i) <= T) {
      seen[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < W; x++) push(x), push((H - 1) * W + x)
  for (let y = 0; y < H; y++) push(y * W), push(y * W + W - 1)
  while (stack.length) {
    const i = stack.pop()
    const x = i % W
    if (x > 0) push(i - 1)
    if (x < W - 1) push(i + 1)
    if (i >= W) push(i - W)
    if (i < px - W) push(i + W)
  }
  for (let i = 0; i < px; i++) {
    if (!seen[i]) continue
    removed++
    const lo = T / 5
    const t = Math.min(1, Math.max(0, (bright(i) - lo) / (T - lo)))
    data[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t))
  }
}
await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out)
console.log(`${slug}: ${mode}, ${Math.round((100 * removed) / px)}% of the pixels made transparent -> ${path.relative(ROOT, out)} (original kept as ${src})`)
