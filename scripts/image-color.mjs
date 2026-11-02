#!/usr/bin/env node
// The colour of an image, for the Visuals "Color" sort (src/lib/sortItems.js):
// the hue that most of its colourful pixels share, and that hue as a hex swatch.
//
//   imageColor(file)  ->  { color: '#rrggbb', hue: 0..359 }      a colourful image
//                         { color: '#rrggbb', hue: null }        a grey / black-and-white one
//
// scripts/instagram-sync.mjs calls it for every post it crops. To add colours to the
// list already on disk (after pulling, or when the sync has not run since this was
// added), run it on its own:
//
//   node scripts/image-color.mjs          fills in src/data/instagram.json entries without a colour
//   node scripts/image-color.mjs --all    recomputes every entry
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIST = path.join(ROOT, 'src/data/instagram.json')

const SAMPLE = 40 // the image is read this many px square
const BINS = 24 // hue histogram bins (15 degrees each)
const MIN_SAT = 0.18 // below this a pixel counts as grey
const MIN_COLOURFUL = 0.04 // share of weight from colourful pixels for the image to get a hue at all

// Hue 0..360, saturation 0..1, lightness 0..1 (HSL).
const hsl = (r, g, b) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h, s, l]
}
const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

export async function imageColor(file) {
  const { data, info } = await sharp(file).rotate().resize(SAMPLE, SAMPLE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = info.width * info.height
  const bins = new Float64Array(BINS)
  const sums = Array.from({ length: BINS }, () => [0, 0, 0, 0]) // r, g, b, weight per bin
  let colourful = 0
  let grey = [0, 0, 0]
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    grey[0] += data[i]
    grey[1] += data[i + 1]
    grey[2] += data[i + 2]
    const [h, s, l] = hsl(r, g, b)
    if (s < MIN_SAT || l < 0.08 || l > 0.95) continue
    // Vivid, mid-lightness pixels say the most about the image's colour.
    const w = s * (1 - Math.abs(l - 0.5) * 1.6)
    if (w <= 0) continue
    const k = Math.floor(h / (360 / BINS)) % BINS
    bins[k] += w
    sums[k][0] += data[i] * w
    sums[k][1] += data[i + 1] * w
    sums[k][2] += data[i + 2] * w
    sums[k][3] += w
    colourful += w
  }
  if (colourful / n < MIN_COLOURFUL) {
    return { color: hex(grey[0] / n, grey[1] / n, grey[2] / n), hue: null }
  }
  // Peak bin, smoothed with its neighbours so a hue split across a bin edge still wins.
  let best = 0
  let bestScore = -1
  for (let k = 0; k < BINS; k++) {
    const score = bins[(k + BINS - 1) % BINS] * 0.5 + bins[k] + bins[(k + 1) % BINS] * 0.5
    if (score > bestScore) {
      bestScore = score
      best = k
    }
  }
  const acc = [0, 0, 0, 0]
  for (const k of [(best + BINS - 1) % BINS, best, (best + 1) % BINS]) for (let c = 0; c < 4; c++) acc[c] += sums[k][c]
  const [h] = hsl(acc[0] / acc[3] / 255, acc[1] / acc[3] / 255, acc[2] / acc[3] / 255)
  return { color: hex(acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]), hue: Math.round(h) % 360 }
}

async function main() {
  const all = process.argv.includes('--all')
  const items = JSON.parse(await readFile(LIST, 'utf8'))
  let done = 0
  for (const item of items) {
    if (!all && item.color !== undefined) continue
    const file = path.join(ROOT, 'public', item.image)
    try {
      Object.assign(item, await imageColor(file))
      done++
    } catch (err) {
      console.warn(`skip ${item.id}: ${err.message}`)
    }
  }
  await writeFile(LIST, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`coloured ${done} of ${items.length} tiles in ${path.relative(ROOT, LIST)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
