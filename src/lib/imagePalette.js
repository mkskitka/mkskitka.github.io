/**
 * Pick the grid's line colour for an open project: plain black or plain white,
 * whichever contrasts with the image. A bright image gets black lines, a dark one
 * gets white. Both line sets and both ends of their gradients use the same colour,
 * so the grid reads as a single flat lattice over the photo.
 *
 * Returns { hFrom, hTo, vFrom, vTo } as [r, g, b] 0..255, or null if the image
 * cannot be read (the caller then keeps the site palette).
 */
const SAMPLE = 48 // the image is drawn this many px wide for sampling
const LIGHT = [245, 245, 248] // "white" lines, over a dark image
const DARK = [10, 10, 12] // "black" lines, over a bright image
const THRESHOLD = 0.45 // mean luminance (0..1) above which the image counts as bright

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
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 709 luminance, so the result follows how bright the image looks.
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    n++
  }
  const mean = n ? sum / n : 0
  const line = mean > THRESHOLD ? DARK : LIGHT
  return { hFrom: line, hTo: line, vFrom: line, vTo: line, mean }
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
