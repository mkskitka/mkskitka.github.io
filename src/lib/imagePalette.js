/**
 * Sample a project image for the grid's line colours.
 *
 * The horizontal lines run left -> right, so their gradient takes the average colour
 * of the image's left and right bands; the vertical lines run top -> bottom and take
 * the top and bottom bands. Colours are pushed toward vivid and light so the thin
 * lines still read over the image itself.
 *
 * Returns { hFrom, hTo, vFrom, vTo } as [r, g, b] 0..255, or null if the image
 * cannot be read.
 */
const BAND = 0.3 // fraction of the width/height each band covers
const SAMPLE = 48 // the image is drawn this many px wide for sampling

export async function sampleGridPalette(url) {
  if (!url) return null
  const img = await load(url).catch(() => null)
  if (!img) return null
  const w = SAMPLE
  const h = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * SAMPLE))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  let data
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return null // cross-origin image without CORS headers
  }
  const avg = (x0, x1, y0, y1) => {
    let r = 0, g = 0, b = 0, n = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    }
    return vivid([r / n, g / n, b / n])
  }
  const bw = Math.max(1, Math.round(w * BAND))
  const bh = Math.max(1, Math.round(h * BAND))
  return {
    hFrom: avg(0, bw, 0, h),
    hTo: avg(w - bw, w, 0, h),
    vFrom: avg(0, w, 0, bh),
    vTo: avg(0, w, h - bh, h),
  }
}

// Lift saturation and lightness so a muted or dark average still makes a visible line.
function vivid([r, g, b]) {
  let [h, s, l] = rgbToHsl(r, g, b)
  s = Math.max(0.55, Math.min(1, s * 1.6))
  l = Math.max(0.55, Math.min(0.8, l * 1.3))
  return hslToRgb(h, s, l)
}

function load(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [h, s, l]
}
function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}
