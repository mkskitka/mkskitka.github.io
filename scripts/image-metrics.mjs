#!/usr/bin/env node
// What an image looks like, in numbers, for the Visuals sort orders
// (src/lib/sortItems.js). Each is cheap pixel statistics, no model:
//
//   color   '#rrggbb'   the hue most of its colourful pixels share, as a swatch
//   hue     0..359      that hue on the colour wheel; null for a grey image
//   light   0..1        mean brightness                        (Dark -> Light)
//   vivid   0..1        mean saturation                        (Muted -> Vivid)
//   busy    0..1        edge density: how much is fine detail  (Calm -> Busy)
//   glitch  0..1        hard, axis-aligned edges and flat blocks versus soft edges
//                       in every direction                     (Organic -> Glitch)
//
// scripts/instagram-sync.mjs calls imageMetrics() for every post it crops. To fill in
// the list already on disk (after pulling, or when the sync has not run since a
// metric was added or tuned), run it on its own:
//
//   node scripts/image-metrics.mjs          entries missing any metric
//   node scripts/image-metrics.mjs --all    every entry
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIST = path.join(ROOT, 'src/data/instagram.json')

const SAMPLE = 64 // the image is read this many px square
const BINS = 24 // hue histogram bins (15 degrees each)
const MIN_SAT = 0.18 // below this a pixel counts as grey
const MIN_COLOURFUL = 0.04 // share of weight from colourful pixels for the image to get a hue at all
// Edges: gradient magnitude (0..1 per pixel) above EDGE counts as an edge; above HARD
// as a hard one. AXIS is how close to horizontal / vertical (degrees) an edge must run
// to count as axis-aligned.
const EDGE = 0.08
const HARD = 0.35
const AXIS = 12
const BUSY_FULL = 0.35 // mean gradient at which `busy` reads 1 (above the busiest image, so the order never flattens)

export const METRICS = ['color', 'hue', 'light', 'vivid', 'busy', 'glitch']

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
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const round = (v) => Math.round(v * 1000) / 1000

export async function imageMetrics(file) {
  const { data, info } = await sharp(file).rotate().resize(SAMPLE, SAMPLE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const n = W * H

  // --- colour: dominant hue, mean brightness, mean saturation ---
  const bins = new Float64Array(BINS)
  const sums = Array.from({ length: BINS }, () => [0, 0, 0, 0]) // r, g, b, weight per bin
  let colourful = 0
  const grey = [0, 0, 0]
  let lightSum = 0
  let satSum = 0
  const lum = new Float32Array(n) // Rec. 709 luminance, 0..1, for the edge measures
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    lum[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lightSum += lum[p]
    grey[0] += data[i]
    grey[1] += data[i + 1]
    grey[2] += data[i + 2]
    const [h, s, l] = hsl(r, g, b)
    satSum += s * (1 - Math.abs(l - 0.5) * 2) // near-black and near-white pixels have no visible colour
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
  let color
  let hue
  if (colourful / n < MIN_COLOURFUL) {
    color = hex(grey[0] / n, grey[1] / n, grey[2] / n)
    hue = null
  } else {
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
    color = hex(acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3])
    hue = Math.round(h) % 360
  }

  // --- edges (Sobel on the luminance): density, hardness, direction ---
  let gradSum = 0
  let edges = 0
  let hard = 0
  let axis = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const at = (dx, dy) => lum[(y + dy) * W + x + dx]
      const gx = (at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1)) / 4
      const gy = (at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1)) / 4
      const m = Math.hypot(gx, gy)
      gradSum += m
      if (m < EDGE) continue
      edges++
      if (m > HARD) hard++
      const deg = (Math.atan2(Math.abs(gy), Math.abs(gx)) * 180) / Math.PI // 0 = vertical edge, 90 = horizontal
      if (deg < AXIS || deg > 90 - AXIS) axis++
    }
  }
  const inner = (W - 2) * (H - 2)
  const busy = clamp01(gradSum / inner / BUSY_FULL)
  // Glitch: edges that run straight along the axes and jump hard, over a calm field.
  // Organic: soft edges in every direction. With almost no edges at all the image is
  // a flat field and sits in the middle.
  const glitch = edges < inner * 0.01 ? 0.5 : clamp01(0.55 * (axis / edges) + 0.45 * (hard / edges))

  return {
    color,
    hue,
    light: round(lightSum / n),
    vivid: round(satSum / n),
    busy: round(busy),
    glitch: round(glitch),
  }
}

async function main() {
  const all = process.argv.includes('--all')
  const items = JSON.parse(await readFile(LIST, 'utf8'))
  let done = 0
  for (const item of items) {
    if (!all && METRICS.every((k) => item[k] !== undefined)) continue
    const file = path.join(ROOT, 'public', item.image)
    try {
      Object.assign(item, await imageMetrics(file))
      done++
    } catch (err) {
      console.warn(`skip ${item.id}: ${err.message}`)
    }
  }
  await writeFile(LIST, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`measured ${done} of ${items.length} tiles in ${path.relative(ROOT, LIST)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
