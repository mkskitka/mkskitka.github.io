import { useLayoutEffect, useRef, useState } from 'react'

// Phone layout for the scattered tiles (components/ProjectThumbs.jsx). On a phone
// there is no room beside the menu panel, so the tiles go under it: each one a square
// block of backdrop grid cells, scattered at random over the free rows (never
// overlapping, always on the grid lines, new positions every page load), the same
// idea as the desktop scatter but with bigger tiles so they are easy to see and tap.
//
// Tiles are `cells` cells square (PHONE_TILE_CELLS by default) where everything fits;
// if the screen is too small for that they go one cell smaller. If a random scatter
// can't place every tile, they go in loose rows instead (each row slid sideways and the
// rows unevenly spaced), and failing that a regular lattice, so nothing is ever dropped
// and nothing ever leaves the screen.
// The Contact tiles use the centred lattice directly (`scatter: false, centered: true,
// columns: 2`): tidy rows of two under the panel, the odd one under the first, on the
// grid lines.
export const PHONE_TILE_CELLS = 2 // tile size in backdrop cells (2 = a 2x2 block)
const PAD = 1 // empty cells kept between tiles
const SCATTER_TRIES = 200 // whole random layouts to try before falling back to rows

/**
 * @param {object} o
 * @param {number} o.count       tiles to place
 * @param {number} o.spacing     backdrop grid column width (css px)
 * @param {number} [o.spacingY]   row height (defaults to the column width)
 * @param {number} [o.originX]    x of the first vertical line (defaults to half a cell)
 * @param {number} [o.originY]    y of the first horizontal line
 * @param {number} o.width       hero width (css px)
 * @param {number} o.height      hero height (css px)
 * @param {number} o.panelBottom bottom edge of the menu panel, relative to the hero (css px)
 * @param {() => number} o.rnd   random source (seeded, so a resize keeps the same layout)
 * @param {boolean} [o.distinctRows] scatter only: no two tiles start on the same horizontal
 *                                line, so their tops are all at different heights
 * @param {number[]} [o.mixed]    scatter only: tile sizes in cells to mix ([2, 3]: half the
 *                                tiles 2x2, half 3x3, which ones at random), tried before
 *                                the single size `cells`; a screen that cannot take the
 *                                mix gets the single size
 * @param {boolean|number} [o.centerY] slide the block down whole rows so it is centred
 *                                between the row under the panel and the bottom
 *                                (`height`, or this many px when a number)
 * @param {number} [o.lift]       centerY only: rows the block sits above that centred
 *                                place; short of room to centre it may take the clear
 *                                row under the panel (never the panel's own rows)
 * @param {boolean} [o.centerX]   slide the whole block to be centred horizontally
 *                                (rows stay on the grid, tiles may cut across columns)
 * @param {boolean} [o.centered]  lattice only: tidy rows filled in order, a clear cell
 *                                kept at the left and right edges, the block centred
 *                                (to the nearest cell, so an odd leftover column puts
 *                                it half a cell off) across the page and down the
 *                                free space, a short last row left-aligned under the
 *                                first column, every tile on the grid lines;
 *                                already centred vertically, so it needs no centerY
 * @param {number} [o.columns]    centered only: this many tiles across (fewer if they
 *                                will not fit), the edge margin allowed to go under a
 *                                cell
 * @param {boolean} [o.widen]     columns only: more than `columns` across when there are
 *                                too few rows for them, rather than smaller tiles
 * @returns {Array<{x:number,y:number,s:number,dx:number,dy:number}|null>}
 */
export function phoneSpots({
  count,
  spacing: s,
  spacingY = s,
  originX = s / 2,
  originY = s / 2,
  width,
  height,
  panelBottom,
  rnd,
  cells = PHONE_TILE_CELLS,
  scatter: wantScatter = true,
  shuffle = true,
  centerX = false,
  centered = false,
  columns = 0,
  widen = false,
  distinctRows = false,
  centerY = false,
  lift = 0,
  mixed = null,
}) {
  // Grid lines sit at origin + k * spacing on each axis (origin is 0 when the grid is
  // fitted to the page, half a cell otherwise).
  const sy = spacingY
  const LX = (k) => originX + k * s
  const LY = (k) => originY + k * sy
  const cols = Math.floor((width - originX) / s + 1e-6)
  const rows = Math.floor((height - originY) / sy + 1e-6)
  const firstRow = Math.ceil((panelBottom - originY) / sy) + 1 // one clear row under the panel
  const spot = (i, j, n) => ({ x: LX(i), y: LY(j), s: n * s, sh: n * sy, dx: 0, dy: 0 })

  // One random scatter of tiles `n` cells square (or each its own size, `pick[t]`).
  // Placing tiles one at a time can paint itself into a corner, so `scatter` below
  // tries this many times over before giving up.
  const scatterOnce = (n, pick = null, distinct = distinctRows) => {
    const used = new Set()
    const tops = new Set() // rows a tile already starts on (distinctRows)
    const out = []
    for (let t = 0; t < count; t++) {
      const m = pick ? pick[t] : n
      if (cols < m || rows - firstRow < m) return null
      let placed = null
      for (let tries = 0; tries < 400 && !placed; tries++) {
        const i = Math.floor(rnd() * (cols - m + 1))
        const j = firstRow + Math.floor(rnd() * (rows - firstRow - m + 1))
        let ok = !(distinct && tops.has(j))
        for (let a = -PAD; a < m + PAD && ok; a++)
          for (let b = -PAD; b < m + PAD && ok; b++) if (used.has(`${i + a},${j + b}`)) ok = false
        if (!ok) continue
        for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) used.add(`${i + a},${j + b}`)
        tops.add(j)
        placed = spot(i, j, m)
      }
      if (!placed) return null
      out.push(placed)
    }
    return out
  }

  const scatter = (n) => {
    for (let k = 0; k < SCATTER_TRIES; k++) {
      const out = scatterOnce(n)
      if (out) return out
    }
    return null
  }
  // The mixed sizes: as even a share of each as the count allows, dealt out at random
  // (a fresh deal each try), scattered with distinct rows first, then without.
  const scatterMixed = () => {
    for (const distinct of distinctRows ? [true, false] : [false]) {
      for (let k = 0; k < SCATTER_TRIES; k++) {
        const pick = Array.from({ length: count }, (_, t) => mixed[t % mixed.length])
        for (let a = pick.length - 1; a > 0; a--) {
          const b = Math.floor(rnd() * (a + 1))
          ;[pick[a], pick[b]] = [pick[b], pick[a]]
        }
        const out = scatterOnce(0, pick, distinct)
        if (out) return out
      }
    }
    return null
  }

  // When a free scatter will not fit: the lattice below, loosened. Each row of tiles is
  // slid sideways by its own random number of cells and the rows are spread down the
  // free space with uneven gaps, so it reads as scattered rather than as a table.
  const loose = (n) => {
    const pitch = n + PAD
    const perRow = Math.floor((cols + PAD) / pitch)
    const maxRows = Math.floor((rows - firstRow + PAD) / pitch)
    if (perRow < 1 || maxRows < 1 || perRow * maxRows < count) return null
    const rowCount = Math.min(maxRows, Math.max(Math.ceil(count / perRow), Math.min(count, maxRows)))
    // How many tiles in each row: spread as evenly as they go, in a random order.
    const sizes = Array.from({ length: rowCount }, (_, r) => Math.floor(count / rowCount) + (r < count % rowCount ? 1 : 0))
    for (let k = sizes.length - 1; k > 0; k--) {
      const r = Math.floor(rnd() * (k + 1))
      ;[sizes[k], sizes[r]] = [sizes[r], sizes[k]]
    }
    let spareY = rows - firstRow - (rowCount * pitch - PAD)
    let j = firstRow
    const out = []
    sizes.forEach((m, r) => {
      const dropBy = Math.floor(rnd() * (spareY / (rowCount - r) + 1))
      j += dropBy
      spareY -= dropBy
      // The tiles of this row, left to right, with the spare columns shared out at random.
      let spareX = cols - (m * pitch - PAD)
      let i = 0
      for (let t = 0; t < m; t++) {
        const gap = Math.floor(rnd() * (spareX + 1))
        i += gap
        spareX -= gap
        out.push(spot(i, j, n))
        i += pitch
      }
      j += pitch
    })
    for (let k = out.length - 1; k > 0; k--) {
      const r = Math.floor(rnd() * (k + 1))
      ;[out[k], out[r]] = [out[r], out[k]]
    }
    return out
  }

  const lattice = (n) => {
    const pitch = n + PAD
    if (centered) {
      const maxRows = Math.floor((rows - firstRow + PAD) / pitch)
      if (maxRows < 1) return null
      // Tiles across: a clear cell kept at each edge, or with `columns` that many (as
      // many as fit edge to edge, if fewer; ProjectThumbs counts on exactly this). With
      // `widen` too, more than `columns` when there are too few rows for them (a short
      // screen takes one wider row of full-size tiles rather than smaller ones).
      const edgeToEdge = Math.floor((cols + PAD) / pitch)
      let perRow = Math.floor((cols - 2 + PAD) / pitch)
      if (columns) perRow = Math.min(widen ? Math.max(columns, Math.ceil(count / maxRows)) : columns, edgeToEdge)
      if (perRow < 1 || perRow * maxRows < count) return null
      perRow = Math.min(perRow, count)
      const rowCount = Math.ceil(count / perRow)
      // Down the free space: centred here, or with `centerY` left at the top for that
      // pass to centre (once, against its own bottom).
      const row0 = centerY ? firstRow : firstRow + Math.floor((rows - firstRow - (rowCount * pitch - PAD)) / 2)
      // The block centred by its full rows; a short last row starts under the first
      // column, left-aligned with the rows above.
      const col0 = Math.floor((cols - (perRow * pitch - PAD)) / 2)
      return Array.from({ length: count }, (_, k) => spot(col0 + (k % perRow) * pitch, row0 + Math.floor(k / perRow) * pitch, n))
    }
    const slots = []
    for (let j = firstRow; j + n <= rows; j += pitch) for (let i = 0; i + n <= cols; i += pitch) slots.push([i, j])
    if (slots.length < count) return null
    if (shuffle) {
      for (let k = slots.length - 1; k > 0; k--) {
        const r = Math.floor(rnd() * (k + 1))
        ;[slots[k], slots[r]] = [slots[r], slots[k]]
      }
    }
    return slots.slice(0, count).map(([i, j]) => spot(i, j, n))
  }

  // distinctRows: a smaller tile on its own line beats a full-size one sharing a line, so
  // every size is tried as a scatter first; the rows and lattice are the last resort.
  const sizes = []
  if (wantScatter && mixed?.length) sizes.push(['mixed'])
  for (let n = cells; n >= 1; n--) sizes.push([n, true])
  if (wantScatter && distinctRows) for (let n = cells; n >= 1; n--) sizes.push([n, false])
  for (const [n, strict] of sizes) {
    const out = n === 'mixed' ? scatterMixed() : wantScatter && distinctRows && strict ? scatter(n) : ((wantScatter ? (scatter(n) ?? loose(n)) : null) ?? lattice(n))
    if (!out) continue
    // centerY: slide the whole block down by whole rows so it sits centred between the
    // clear row under the panel and the bottom (`centerY` px, or `height` when true),
    // still on the grid rows.
    let placed = out
    if (centerY && placed.length) {
      const bottomPx = typeof centerY === 'number' ? centerY : height
      const top = Math.min(...placed.map((o) => o.y))
      const bottom = Math.max(...placed.map((o) => o.y + o.sh))
      const freeTop = LY(firstRow)
      const freeBottom = LY(Math.floor((bottomPx - originY) / sy + 1e-6))
      const panelRow = Math.ceil((panelBottom - originY) / sy) // the first row below the panel
      const shiftRows = Math.max(panelRow - firstRow, Math.floor((freeBottom - bottom - (top - freeTop)) / 2 / sy) - lift)
      if (shiftRows !== 0) placed = placed.map((o) => ({ ...o, y: o.y + shiftRows * sy }))
    }
    // centerX: keep the rows on the grid but slide the whole block sideways so it is
    // centred on the page. The tiles then cut across columns, which is fine.
    if (centerX && placed.length) {
      const left = Math.min(...placed.map((o) => o.x))
      const right = Math.max(...placed.map((o) => o.x + o.s))
      const shift = (width - (right - left)) / 2 - left
      return placed.map((o) => ({ ...o, x: o.x + shift }))
    }
    return placed
  }
  return Array.from({ length: count }, () => null)
}

// The hero menu panel the tiles keep clear of.
export const PANEL = '.header.margin-bottom_none'

/**
 * Keeps `ro` (a ResizeObserver) watching the section's menu panel. Call the returned
 * function at the start of each layout: it looks the panel up again, so a panel that
 * mounts late or is replaced is watched too, and returns it (or null).
 */
export function panelWatcher(section, ro) {
  let seen = null
  return () => {
    const el = section.querySelector(PANEL)
    if (el !== seen) {
      if (seen) ro.unobserve(seen)
      if (el) ro.observe(el)
      seen = el
    }
    return el
  }
}

/**
 * React hook: phone positions for the tiles inside `navRef` (a nav inside the hero
 * section), re-laid out when the hero or the menu panel changes size and when the
 * backdrop publishes a new --grid-spacing. Returns null on desktop widths.
 */
export function usePhoneSpots(navRef, count, opts = {}) {
  const [spots, setSpots] = useState(null)
  const seed = useRef(Math.floor(Math.random() * 1e9))
  // Callers pass a fresh object every render: re-run only when one of its values
  // changes (compared one by one, so functions and elements are fine as options).
  const lastOpts = useRef(opts)
  const optsVersion = useRef(0)
  const prev = lastOpts.current
  const keys = new Set([...Object.keys(prev), ...Object.keys(opts)])
  if ([...keys].some((k) => !Object.is(prev[k], opts[k]))) {
    lastOpts.current = opts
    optsVersion.current++
  }
  const version = optsVersion.current
  useLayoutEffect(() => {
    const el = navRef.current
    const section = el?.closest('.section')
    if (!el || !section) return undefined
    let trackPanel = () => section.querySelector(PANEL)
    const layout = () => {
      const panelEl = trackPanel()
      if (window.matchMedia('(min-width: 768px)').matches) {
        setSpots(null)
        return
      }
      const cs = getComputedStyle(section)
      const s = parseFloat(cs.getPropertyValue('--grid-spacing')) || 33
      const panel = panelEl?.getBoundingClientRect()
      const panelBottom = panel ? panel.bottom - section.getBoundingClientRect().top : 0
      setSpots(
        phoneSpots({
          count,
          spacing: s,
          spacingY: parseFloat(cs.getPropertyValue('--grid-spacing-y')) || s,
          originX: parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0,
          originY: parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0,
          width: section.clientWidth,
          height: section.clientHeight,
          panelBottom,
          rnd: mulberry32(seed.current),
          ...lastOpts.current,
        }),
      )
    }
    const ro = new ResizeObserver(layout)
    ro.observe(section)
    trackPanel = panelWatcher(section, ro) // the panel too: the tiles sit under it
    layout()
    const mo = new MutationObserver(layout)
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [navRef, count, version]) // eslint-disable-line react-hooks/exhaustive-deps
  return spots
}

const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
