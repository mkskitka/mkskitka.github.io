// Phone layout for the scattered tiles (components/ProjectThumbs.jsx). On a phone
// there is no room beside the menu panel, so the tiles go under it: each one a square
// block of backdrop grid cells, scattered at random over the free rows (never
// overlapping, always on the grid lines, new positions every page load), the same
// idea as the desktop scatter but with bigger tiles so they are easy to see and tap.
//
// Tiles are PHONE_TILE_CELLS cells square where everything fits; if the screen is too
// small for that they go one cell smaller. If a random scatter can't place every
// tile, they fall into a shuffled regular lattice instead, so nothing is ever dropped.
export const PHONE_TILE_CELLS = 3 // tile size in backdrop cells (3 = a 3x3 block)
const PAD = 1 // empty cells kept between tiles

/**
 * @param {object} o
 * @param {number} o.count       tiles to place
 * @param {number} o.spacing     backdrop grid spacing (css px)
 * @param {number} o.width       hero width (css px)
 * @param {number} o.height      hero height (css px)
 * @param {number} o.panelBottom bottom edge of the menu panel, relative to the hero (css px)
 * @param {() => number} o.rnd   random source (seeded, so a resize keeps the same layout)
 * @returns {Array<{x:number,y:number,s:number,dx:number,dy:number}|null>}
 */
export function phoneSpots({ count, spacing: s, width, height, panelBottom, rnd, cells = PHONE_TILE_CELLS }) {
  const L = (k) => s / 2 + k * s // position of grid line k
  const cols = Math.floor((width - s / 2) / s)
  const rows = Math.floor((height - s / 2) / s)
  const firstRow = Math.ceil((panelBottom - s / 2) / s) + 1 // one clear row under the panel
  const spot = (i, j, n) => ({ x: L(i), y: L(j), s: n * s, dx: 0, dy: 0 })

  const scatter = (n) => {
    if (cols < n || rows - firstRow < n) return null
    const used = new Set()
    const out = []
    for (let t = 0; t < count; t++) {
      let placed = null
      for (let tries = 0; tries < 400 && !placed; tries++) {
        const i = Math.floor(rnd() * (cols - n + 1))
        const j = firstRow + Math.floor(rnd() * (rows - firstRow - n + 1))
        let ok = true
        for (let a = -PAD; a < n + PAD && ok; a++)
          for (let b = -PAD; b < n + PAD && ok; b++) if (used.has(`${i + a},${j + b}`)) ok = false
        if (!ok) continue
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) used.add(`${i + a},${j + b}`)
        placed = spot(i, j, n)
      }
      if (!placed) return null
      out.push(placed)
    }
    return out
  }

  const lattice = (n) => {
    const pitch = n + PAD
    const slots = []
    for (let j = firstRow; j + n <= rows; j += pitch) for (let i = 0; i + n <= cols; i += pitch) slots.push([i, j])
    if (slots.length < count) return null
    for (let k = slots.length - 1; k > 0; k--) {
      const r = Math.floor(rnd() * (k + 1))
      ;[slots[k], slots[r]] = [slots[r], slots[k]]
    }
    return slots.slice(0, count).map(([i, j]) => spot(i, j, n))
  }

  for (let n = cells; n >= 1; n--) {
    const out = scatter(n) ?? lattice(n)
    if (out) return out
  }
  return Array.from({ length: count }, () => null)
}
