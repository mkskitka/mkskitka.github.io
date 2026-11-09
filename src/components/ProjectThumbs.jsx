import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { projects, TAG_LABELS } from '../data/projects.js'
import { phoneSpots } from '../lib/phoneTiles.js'
import { BOUNCE } from './GridInkBackdrop.jsx'

/**
 * Scattered tiles, used for Systems (projects; click opens the project view) and
 * Visuals (`items` + `external`: each tile links out in a new tab).
 * One square per item, TILE_CELLS backdrop cells across, scattered over random
 * grid cells beside the menu panel (never overlapping, always on the
 * lines, chosen once per page load). The spots are random but who gets which is not:
 * on each screen the items take them in order from the left (leftToRight below), so a
 * sort order reads left to right here too. The page's top and bottom grid rows are
 * left empty. Hovering a tile grows it by one cell each way,
 * expanding away from the nearest page edge so it stays on screen; the other
 * tiles dim. Clicking opens the project (`onSelect(project, event)`).
 *
 * Phones scatter their (larger) tiles under the panel instead (lib/phoneTiles.js).
 *
 * `cells` overrides the tile size (a number, or `{ desktop, phone }`), and `rows` lays
 * the tiles out in tidy rows on the grid (left to right, top to bottom, a clear cell
 * between them, a clear cell at the edges, the block centred) instead of scattering them.
 * `columns` (`{ phone }`) sizes the phone tiles so that many fit across the page (the
 * edge margin may then be under a cell, and the rows are centred by pixel; on phones
 * only the horizontal grid lines show, so the rows still sit on the grid).
 * Systems uses double-size tiles in rows (three across on phones); Visuals keeps the scatter.
 * `rows` true lays the tiles out in as many rows as fit; a number caps the rows at that
 * (Systems: 1 on desktop), so a long list runs across more screens instead of growing
 * downward. `sizes` ({ desktop: [min, max], phone: [2, 3] }) gives the scatter layout
 * tiles of mixed sizes: on desktop each drawn at random between the two, on phones
 * half the tiles of each size listed. `opacity` / `dim` set the tiles'
 * opacity at rest and the others' while one is hovered (custom.css --thumb-opacity,
 * --thumb-opacity-dim), for this set of tiles only. `grow` false turns off the hover
 * enlargement (the tile growing a cell and its image zooming), as on Systems.
 * `phoneRows` caps the rows of tiles under the panel on phones (Systems 2, Visuals 3);
 * `phoneLift` sits the block that many rows above its centred place there.
 * `dimBehind`: one of the corner dropdowns' lists is open (which one, or falsy), so the
 * tiles under it are dulled.
 * `stepped` (Systems grid view, desktop): the wheel moves the tiles a screen's worth of
 * columns at a time (as many as stand beside the menu panel: two tiles showing, a swipe
 * moves two). Each step lands the next column of tiles exactly where the first one
 * stood when the tiles opened, and they then hold there for STEPPED.hold ms before the
 * wheel can move them again, so they lock into place between moves rather than sliding
 * freely. The arrow keys step the same; the end arrows too. Phones keep their swipe.
 * While stepped, the tiles tell the backdrop when they lock into place and when they
 * move again (a 'grid:columns' event on the section with every vertical grid line along
 * the tiles on screen, { x, y0, y1, edge } from each tile's top edge to its bottom, edge
 * marking the two that border a tile, or an empty list), and it lights those lines up
 * (GridInkBackdrop SETTINGS.columnLights).
 *
 * More items than MAX_PER_SCREEN: the rest are scattered over further screens' worth
 * of grid to the right, off the page. Scrolling (wheel, trackpad, swipe, left/right
 * arrows) slides all the tiles left along the grid and brings the next ones in from
 * the right; there is no scroll bar. On desktop they fade out before reaching the
 * menu panel, and they always come to rest on the grid lines.
 * To show there is more: the bottom grid row is kept free of tiles and holds an arrow
 * at each end (shown only when there is more that way; a click moves one screen), and
 * each time the tiles open they slide in from the right. `arrowLabels` (['darker',
 * 'lighter']) writes next to each arrow what lies that way under the current sort
 * order (Visuals; lib/sortItems.js).
 *
 * `bounce` (Visuals): each time the tiles open they hop on the beat for as long as the
 * backdrop's lines bounce (GridInkBackdrop SETTINGS.bounce), each by its own amount.
 *
 * Tiles stop just short of the grid lines around them (--thumb-gap in custom.css), so
 * the backdrop's lines are never covered by an image.
 *
 * Idle hint (IDLE_HINT): if nothing is pressed for a few seconds, one tile gives a small
 * hop, and another after the same wait, until something is pressed.
 *
 * `keep`: the tiles are closed only because one of them is open, so they stay scrolled
 * where they were and come back on the same screen. `focus` (an item's index) moves
 * them to that item's screen while closed, for when the open item was changed by swiping.
 *
 * Thumbnails come from src/data/projects.js (`thumb`): an image, a gif, or a
 * looping muted video.
 */
const PAD = 1 // empty cells kept around every tile (1 leaves room for the hover, which grows a tile by one cell)
// Tile size in backdrop grid cells (2 = a 2x2 block). If a tile can't be placed at this
// size (small window, many tiles) it goes a cell smaller rather than being dropped.
const TILE_CELLS = { desktop: 1, phone: 2 }
// The most tiles shown on one screen. With more than this, the rest wait off the right
// edge and scrolling brings them in.
const MAX_PER_SCREEN = { desktop: 10, phone: 6 }
// `stepped` scrolling: one swipe moves one step (a screen's worth of columns), never more. `pull` is how much wheel
// travel (px) a swipe needs to count; after its step the tiles hold in place for `hold`
// ms, during which the wheel is ignored altogether, and after it the rest of the same
// swipe is still ignored: a trackpad flick keeps sending ever smaller events as it
// coasts (down to about 1px every few ms, and on until the pad is touched again, with
// no pause). The next swipe is told from that coasting by its size: the coasting only
// ever gets smaller, so an event of at least `swipe` px that is more than `above` times
// the smallest event seen since the step can only be a new swipe (measured on real
// trackpad data: coasting settles at 1-3px, a swipe reaches 30-80px within a few
// events). A pause of `gap` ms or a change of direction counts as a new swipe too. A
// gesture keeps the axis (up/down or sideways) it started on, so a slanted swipe is not
// read as a change of direction.
const STEPPED = { pull: 150, hold: 350, gap: 250, swipe: 8, above: 4 }
export const SEEN_MIN = 0.12 // how visible a tile stays once it has slid behind the menu panel (1 = not dulled); Home.jsx dulls the menu links under an open dropdown list by the same amount
// Safari (desktop and iOS; Chrome on iOS too, which is Safari underneath): plays HEVC video with
// alpha, not VP9 with alpha. Everything else is the other way round.
// A mouse to hover with: the clips are fetched up front, so a hover starts them at once
// (they are small, and only the tiles near the screen are mounted). Without one (phones)
// a clip plays by itself while its tile is on screen, and is fetched only then.
const CAN_HOVER = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches
const AUTOPLAY_SEEN = 0.5 // phones: how much of a tile must be on screen for its clip to play
// Show the clip over the still the instant it has a frame to show (at once when
// preloaded), so the still is never swapped for a blank.
const showClip = (v) => {
  const show = () => { if (!v.paused) v.classList.add('is-playing') }
  if (v.readyState >= 2) show()
  else v.addEventListener('playing', show, { once: true })
}
const stopClip = (v) => {
  v.pause()
  v.classList.remove('is-playing')
}
const SAFARI = typeof navigator !== 'undefined' && /apple/i.test(navigator.vendor) && !/crios|fxios|edgios/i.test(navigator.userAgent) ? true : typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const SEEN_MIN_STEPPED = 0 // the same in the stepped Systems grid: gone completely, glass and all (--seen-tile fades the whole tile there; elsewhere --seen fades the picture)
const CLOSE_MS = 320 // how long the tiles take to fade out when closed (matches .is-closing in custom.css)
const TAP_SLOP = 16 // px a finger may move and still count as a tap rather than a swipe

// Idle hint: with the tiles open and nothing pressed, one tile hops now and then.
const IDLE_HINT = {
  enabled: false, // off: no idle hop (true puts it back)
  every: 20, // seconds of nothing being pressed before a hop, and between hops
  height: 0.14, // how high the tile hops, as a fraction of its own size (0.14 = slight)
  seconds: 0.7, // how long one hop (with its small second bounce) takes
}

const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// A screen's scattered spots, handed out in the items' order: the first item gets the
// spot furthest left, the next the second furthest left, and so on (two spots starting on
// the same column: the upper one first), so the sort order reads left to right across the
// scatter as it does in the rows. Tiles that found no spot (null) come last.
const leftToRight = (spots) => {
  const placed = spots.filter(Boolean).sort((a, b) => a.x - b.x || a.y - b.y)
  return placed.concat(spots.filter((o) => !o))
}

// The tiles' hop: one per beat, for about as long as the lines take to bounce and settle.
const BEAT = 60 / BOUNCE.bpm
const BEATS = Math.max(1, Math.round((BOUNCE.seconds + 0.6) / BEAT))

export default function ProjectThumbs({ open = false, onSelect, items = projects, label = 'Projects', external = false, bounce = false, titles = true, keep = false, focus = null, cells = TILE_CELLS, rows = false, columns = null, arrowLabels = null, sizes = null, opacity = null, dim = null, grow = true, phoneRows = null, phoneLift = 0, dimBehind = false, stepped = false }) {
  const nav = useRef(null)
  const tileCells = typeof cells === 'number' ? { desktop: cells, phone: cells } : { ...TILE_CELLS, ...cells }
  const seed = useRef(Math.floor(Math.random() * 1e9))
  const [spots, setSpots] = useState(null) // per project: { x, y, s, dx, dy } in px, or null on phones
  // Scrolling, when there are more tiles than fit a screen: how far the tiles can slide
  // (`max` px, 0 = no scrolling), what they come to rest on (`snap` px: a grid column on
  // desktop, a screen on phones), and on desktop the columns on screen and where the
  // tiles fade out beside the panel.
  const [strip, setStrip] = useState(null)
  const [shift, setShift] = useState(0) // grid columns scrolled, once the tiles have come to rest
  // Where the tiles are heading (px, a whole number of screens). Only the tiles within a
  // few screens of it are rendered, so a long list (every Instagram post) costs no more
  // than a short one.
  const [near, setNear] = useState(0)
  const track = useRef(null)
  const pos = useRef({ cur: 0, target: 0 }) // px scrolled now, and where it is heading
  const draggedAt = useRef(0) // time of the last swipe, so letting go over a tile doesn't open it
  const [ends, setEnds] = useState(0) // which arrows show: 1 = more to the left, 2 = more to the right
  const goBy = useRef(null) // (dir) => move one screen left (-1) or right (1); set while scrollable
  const wasOpen = useRef(false)
  // Closing: for CLOSE_MS after `open` goes false the tiles stay in the layout with
  // .is-closing, so they can fade out instead of vanishing (custom.css).
  const [closing, setClosing] = useState(false)
  const openBefore = useRef(open)
  useEffect(() => {
    if (openBefore.current && !open) {
      setClosing(true)
      const t = setTimeout(() => setClosing(false), CLOSE_MS)
      openBefore.current = open
      return () => clearTimeout(t)
    }
    if (open) setClosing(false)
    openBefore.current = open
    return undefined
  }, [open])

  // Lay the tiles out on the grid. Re-run on resize and whenever the grid spacing changes.
  useLayoutEffect(() => {
    const el = nav.current
    const section = el?.closest('.section')
    if (!el || !section) return undefined

    const layout = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) {
        const pcs = getComputedStyle(section)
        const s = parseFloat(pcs.getPropertyValue('--grid-spacing')) || 33
        const panel = section.querySelector('.header.margin-bottom_none')?.getBoundingClientRect()
        const panelBottom = panel ? panel.bottom - section.getBoundingClientRect().top : 0
        const originX = parseFloat(pcs.getPropertyValue('--grid-origin-x')) || 0
        // One screen's worth of tiles at a time, each screen laid out like the first and
        // placed a screen (plus a clear column) further right.
        const pcols = Math.floor((section.clientWidth - originX) / s + 1e-6)
        const screenW = (pcols + PAD) * s
        const psy = parseFloat(pcs.getPropertyValue('--grid-spacing-y')) || s
        const poy = parseFloat(pcs.getPropertyValue('--grid-origin-y')) || 0
        const prows = Math.floor((section.clientHeight - poy) / psy + 1e-6)
        const LYp = (k) => poy + k * psy
        // Tile size: as asked, or (rows with `columns`) the largest that puts that many
        // across the page with a clear cell between them and at least half a cell spare.
        const pcolumns = rows ? columns?.phone || 0 : 0
        const pc = pcolumns ? Math.max(1, Math.floor((pcols - 1 - (pcolumns - 1) * PAD) / pcolumns)) : tileCells.phone
        // Rows: a screen holds as many tiles as its lattice of pc-cell blocks (a cell
        // apart, a clear cell at each edge) has slots under the panel, the bottom row
        // left for the arrows.
        const pfirstRow = Math.ceil((panelBottom - poy) / psy) + 1
        const pperRow = Math.max(1, pcolumns ? Math.min(pcolumns, Math.floor((pcols + PAD) / (pc + PAD))) : Math.floor((pcols - 2 + PAD) / (pc + PAD)))
        // `phoneRows` caps the rows of tiles under the panel (Systems grid 2, Visuals 3),
        // whatever the screen's free height: the lattice gets at most that many rows,
        // and the scatter is given only that much height to spread over. (The Systems
        // random layout passes none: six 2x2 tiles need more than two rows to scatter,
        // and short of room phoneTiles.js would shrink them to 1x1.)
        const pmaxRows = Math.max(1, Math.min(phoneRows || Infinity, Math.floor((prows - 1 - pfirstRow + PAD) / (pc + PAD))))
        const pHeight = phoneRows ? Math.min(section.clientHeight, LYp(pfirstRow + phoneRows * (pc + PAD))) : section.clientHeight
        const per = rows ? pperRow * pmaxRows : MAX_PER_SCREEN.phone
        const screens = Math.max(1, Math.ceil(items.length / per))
        const rnd = mulberry32(seed.current)
        // The bottom grid row stays clear of tiles: it is the arrows' when scrollable,
        // and the scatter leaves it empty either way (the top row is the panel's).
        const clearBottom = screens > 1 || !rows
        const out = []
        for (let p = 0; p < screens; p++) {
          const placed = phoneSpots({
            count: Math.min(per, items.length - p * per),
            spacing: s,
            spacingY: psy,
            originX,
            originY: poy,
            width: section.clientWidth,
            height: clearBottom ? Math.min(pHeight, section.clientHeight - psy) : pHeight,
            panelBottom,
            rnd,
            cells: pc,
            mixed: rows ? null : sizes?.phone, // scatter with `sizes.phone` ([2, 3]): tiles of both sizes
            scatter: !rows, // rows: the centred lattice, filled in order
            shuffle: !rows,
            centered: rows,
            columns: pcolumns,
            centerX: pcolumns > 0,
            distinctRows: !rows, // scatter: every tile's top edge on a different grid line
            // The block sits centred between the panel and the screen's bottom (above
            // the arrows' row when scrollable), even when `phoneRows` caps its height.
            centerY: section.clientHeight - (clearBottom ? psy : 0),
            lift: phoneLift,
          })
          out.push(...(rows ? placed : leftToRight(placed)).map((o) => o && { ...o, x: o.x + p * screenW }))
        }
        setSpots(out)
        setStrip({
          max: (screens - 1) * screenW,
          snap: screenW,
          step: s,
          page: screenW,
          per,
          // Two cells wide, so they are easy to tap.
          // The arrows sit half a cell in from each side edge (not in the very corners,
          // which a phone's rounded screen corners cut off).
          arrows: { y: poy + (prows - 1) * psy, left: originX + s / 2, right: originX + (pcols - 2.5) * s, w: 2 * s, h: psy },
        })
        return
      }
      // The backdrop publishes the grid on the section: cell size per axis and where
      // the first line sits (0 when the grid is fitted to the page).
      const cs = getComputedStyle(section)
      const sx = parseFloat(cs.getPropertyValue('--grid-spacing')) || 64
      const sy = parseFloat(cs.getPropertyValue('--grid-spacing-y')) || sx
      const ox = parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0
      const oy = parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0
      const W = section.clientWidth
      const H = section.clientHeight
      const LX = (k) => ox + k * sx // position of vertical grid line k
      const LY = (k) => oy + k * sy
      const panel = section.querySelector('.header.margin-bottom_none')?.getBoundingClientRect()
      const secRect = section.getBoundingClientRect()
      const panelRight = panel ? panel.right - secRect.left : 0
      const firstCol = Math.ceil((panelRight - ox) / sx) + 1 // one clear column after the panel
      const cols = Math.floor((W - ox) / sx + 1e-6)
      const gridRows = Math.floor((H - oy) / sy + 1e-6)
      const rnd = mulberry32(seed.current)
      const used = new Set()
      // Columns beside the panel = one screen. Tiles past MAX_PER_SCREEN go on the
      // screens after it, further along the same grid (off the page until scrolled to).
      const span = Math.max(1, cols - firstCol)
      const dc = tileCells.desktop
      // Rows: tiles go in order, left to right then top to bottom, in a lattice of
      // dc-cell blocks a clear cell apart, the block of rows centred on the free height...
      // A screen holds as many tiles as the lattice has slots.
      const pitch = dc + PAD
      const perRow = Math.max(1, Math.floor(span / pitch)) // a clear cell at the page's right edge too
      const latticeRows = (free) => Math.max(1, Math.floor((free + PAD) / pitch))
      // The page's top grid row is left to the corner tools (components/VisualsSort.jsx),
      // which have no backing of their own. Everything on one screen if the lattice
      // holds it; otherwise the bottom grid row goes to the arrows and the lattice is
      // sized on what is left.
      let maxRows = latticeRows(gridRows - 1)
      if (rows && items.length > perRow * maxRows) maxRows = latticeRows(gridRows - 2)
      // `rows` as a number caps the rows (Systems: two), the rest going on further screens.
      if (typeof rows === 'number') {
        maxRows = Math.min(maxRows, rows)
        if (items.length > perRow * maxRows) maxRows = Math.min(rows, latticeRows(gridRows - 2))
      }
      // A scatter of mixed sizes holds fewer per screen: about what the area allows
      // for tiles of the average size, each with its clear cell around it.
      const avg = sizes?.desktop ? (sizes.desktop[0] + sizes.desktop[1]) / 2 + PAD : 0
      // The scatter keeps the page's top and bottom grid rows clear (the bottom one is
      // the arrows' when scrollable in any case): tiles go on rows scatterTop and down,
      // scatterRows of them. A window too short to spare the rows uses what it has.
      const scatterTop = gridRows >= 3 ? 1 : 0
      const scatterRows = Math.max(1, gridRows - 2)
      const per = rows ? perRow * maxRows : sizes?.desktop ? Math.max(3, Math.floor((span * scatterRows) / (avg * avg))) : MAX_PER_SCREEN.desktop
      const screens = Math.max(1, Math.ceil(items.length / per))
      const tileRows = screens > 1 ? gridRows - 1 : gridRows // when scrollable the bottom row is the arrows'
      const rowCount = Math.min(maxRows, Math.ceil(Math.min(per, items.length) / perRow))
      // The block of rows is centred on the whole page height (so it balances the menu
      // panel, not the space above the arrows), then kept clear of the arrows' row.
      const blockRows = rowCount * pitch - PAD
      // (A half-row tie goes up, toward the menu panel; never into the top row, unless
      // the window is too short for the block to fit under it.)
      const row0 = Math.max(0, Math.min(tileRows - blockRows, Math.max(1, Math.floor((gridRows - blockRows) / 2))))
      // ...and centred (to the nearest column) between the panel and the right edge.
      const rowCols = Math.min(perRow, items.length) * pitch - PAD
      const col0 = Math.max(0, Math.floor((span - rowCols) / 2))
      // Stepped (the Systems grid): centred exactly, to the pixel, between the panel's
      // right edge and the page's right edge, so the tile sits in the middle of that
      // space when it locks. With an odd number of spare columns that puts its edges
      // half a cell off the grid lines; the rows still sit on the lines.
      const shift = stepped && rows ? panelRight + (W - panelRight - rowCols * sx) / 2 - LX(firstCol + col0) : 0
      const drawn = items.map((_, n) => {
        const first = firstCol + Math.floor(n / per) * span
        if (rows) {
          const k = n % per
          // Order: with the rows capped (Systems) left to right along each row; with
          // as many rows as fit (Visuals) down each column, then the next column, so a
          // part-filled last screen ends in whole columns with no empty rows under them.
          const colMajor = rows === true
          const i = first + col0 + (colMajor ? Math.floor(k / rowCount) : k % perRow) * pitch
          const j = row0 + (colMajor ? k % rowCount : Math.floor(k / perRow)) * pitch
          const c = dc
          const dy = j + c + 1 <= tileRows ? 0 : -sy
          return { x: LX(i) + shift, y: LY(j), s: c * sx, sh: c * sy, cell: sx, cellY: sy, col: i, n: c, dx: 0, dy }
        }
        // c = tile size in cells: the wanted size first, then smaller if it will not fit.
        // With `sizes` ({ desktop: [min, max] }) each tile wants its own size, drawn at
        // random between the two (the same draw each time, from the seed).
        const want = sizes?.desktop ? sizes.desktop[0] + Math.floor(rnd() * (sizes.desktop[1] - sizes.desktop[0] + 1)) : dc
        for (let c = want; c >= 1; c--) {
          if (span < c || scatterRows < c) continue
          for (let tries = 0; tries < 500; tries++) {
            const i = first + Math.floor(rnd() * (span - c + 1))
            const j = scatterTop + Math.floor(rnd() * (scatterRows - c + 1))
            let ok = i + c <= cols || screens > 1
            for (let a = -PAD; a < c + PAD && ok; a++) for (let b = -PAD; b < c + PAD && ok; b++) if (used.has(`${i + a},${j + b}`)) ok = false
            if (!ok) continue
            for (let a = 0; a < c; a++) for (let b = 0; b < c; b++) used.add(`${i + a},${j + b}`)
            // Hover grows the tile by one cell, toward the page centre so it never leaves
            // the screen (which way across depends on how far the tiles are scrolled;
            // worked out when drawn).
            const dy = j + c + 1 <= tileRows ? 0 : -sy
            return { x: LX(i), y: LY(j), s: c * sx, sh: c * sy, cell: sx, cellY: sy, col: i, n: c, dx: 0, dy }
          }
        }
        return null
      })
      // Scatter: each screen's spots go to its items in order, left to right.
      const out = rows ? drawn : drawn.flatMap((_, n) => (n % per ? [] : leftToRight(drawn.slice(n, n + per))))
      setSpots(out)
      // How far the tiles can scroll: to where the last tile (plus a clear cell) meets
      // the page's right edge, on a whole column, rather than a whole screen past the
      // last full one, so a part-filled last screen leaves no empty run at the end.
      const lastCol = out.reduce((m, p) => (p ? Math.max(m, p.col + p.n) : m), 0)
      const maxPx = Math.min((screens - 1) * span * sx, Math.max(0, Math.ceil((LX(lastCol) + sx - LX(cols)) / sx) * sx))
      setStrip({
        max: maxPx,
        snap: sx,
        step: sx,
        cols,
        fadeFrom: LX(firstCol - 1),
        fadeTo: LX(firstCol),
        page: span * sx,
        per,
        perRow, // tiles across one screen: how many columns a stepped move goes
        // The arrows sit in the first and last whole grid cells of the bottom row, at the
        // page's edges (not beside the panel, which on a wide screen is well in from the left).
        arrows: { y: LY(gridRows - 1), left: LX(0), right: LX(cols - 1), w: sx, h: sy },
      })
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(section)
    // Phones: the tiles sit under the panel, so re-lay them out when the panel's size changes.
    const panelEl = section.querySelector('.header.margin-bottom_none')
    if (panelEl) ro.observe(panelEl)
    const mo = new MutationObserver(layout) // --grid-spacing is set as an inline style by the backdrop
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [items.length, tileCells.desktop, tileCells.phone, rows, stepped, columns?.phone, sizes?.desktop?.[0], sizes?.desktop?.[1], sizes?.phone?.join(), phoneRows, phoneLift])
  // Phones (nothing to hover with): a tile's clip plays while at least AUTOPLAY_SEEN of
  // the tile is on screen and the tiles are open, and stops when it slides off or they
  // close. New tiles are watched as they mount (the render effect below).
  const autoplay = useRef(null)
  const openNow = useRef(open)
  openNow.current = open
  useEffect(() => {
    if (CAN_HOVER) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        for (const { target: v, isIntersecting, intersectionRatio } of entries) {
          if (openNow.current && isIntersecting && intersectionRatio >= AUTOPLAY_SEEN) {
            v.play().catch(() => {})
            showClip(v)
          } else stopClip(v)
        }
      },
      { threshold: [0, AUTOPLAY_SEEN] },
    )
    autoplay.current = io
    return () => {
      io.disconnect()
      autoplay.current = null
    }
  }, [])
  useEffect(() => {
    // Opened or closed: look at every clip afresh (re-observing reports its state again).
    const io = autoplay.current
    if (!io || !track.current) return
    for (const v of track.current.querySelectorAll('.project_thumb_hover')) {
      if (open) {
        io.unobserve(v)
        io.observe(v)
      } else stopClip(v)
    }
  }, [open])
  useEffect(() => {
    dull(pos.current.cur)
    // Phones: clips of tiles mounted since the last render come under watch (observe is a no-op for the rest).
    if (autoplay.current && track.current) for (const v of track.current.querySelectorAll('.project_thumb_hover')) autoplay.current.observe(v)
  }) // after every render: the tiles near the panel (or under the open list) get their --seen as soon as they exist

  // Desktop, when scrollable: a tile that has slid left past the menu panel's edge is
  // dulled (its --seen, which custom.css multiplies into the media and title opacity:
  // SEEN_MIN behind the panel, 1 fully clear of it, in between while crossing), so the
  // menu stays readable over it and half-hidden tiles do not pull the eye.
  // With `dimBehind` (a corner dropdown's list is open) the tiles under that list are
  // dulled too.
  const dull = (scrolled) => {
    const edge = strip?.fadeFrom
    if (!track.current) return
    const list = dimBehind ? document.querySelector('.visuals_sort_main.is-open .visuals_sort_list')?.getBoundingClientRect() : null
    if (edge == null && !list) return
    for (const el of track.current.querySelectorAll('.project_thumb')) {
      let seen = 1
      if (edge != null) {
        const x = parseFloat(el.style.getPropertyValue('--x')) - scrolled
        const w = parseFloat(el.style.getPropertyValue('--s')) || 1
        const clear = Math.min(1, Math.max(0, (x + w - edge) / w)) // the part of the tile right of the panel's edge
        const floor = stepped ? SEEN_MIN_STEPPED : SEEN_MIN
        seen = floor + (1 - floor) * clear
      }
      if (list) {
        const r = el.getBoundingClientRect()
        if (r.left < list.right && r.right > list.left && r.top < list.bottom && r.bottom > list.top) seen = Math.min(seen, SEEN_MIN)
      }
      // Stepped grid: the whole tile fades (glass, picture and title); otherwise only the picture.
      el.style.setProperty('--seen', stepped ? '1' : seen.toFixed(3))
      el.style.setProperty('--seen-tile', stepped ? seen.toFixed(3) : '1')
    }
  }

  // Scrolling. Wheel / swipe / arrow keys move a target; the tiles ease toward it and,
  // once the input stops, come to rest on the grid.
  const max = strip?.max ?? 0
  const snap = strip?.snap ?? 1
  const step = strip?.step ?? 1
  const page = strip?.page ?? snap
  // Stepped scrolling (desktop rows): the tiles' column x positions in order (one per
  // column, however many rows), so a step can land a later column where the first stood.
  const stops = stepped && strip && spots ? [...new Set(spots.filter(Boolean).map((t) => t.x))].sort((a, b) => a - b) : null
  const stepCols = strip?.perRow ?? 1 // columns per step: as many as show beside the panel
  const stopsKey = stops ? stops.join() : ''
  useEffect(() => {
    const p = pos.current
    const apply = () => {
      if (track.current) track.current.style.transform = p.cur ? `translate3d(${-p.cur}px, 0, 0)` : ''
      // Stepped: the fade is judged from where the tiles are heading, not where they are,
      // so a tile going behind the menu starts fading the moment the step starts and is
      // gone as it lands, the mirror of one coming back out, which brightens over the
      // slide and is full as it lands (the opacity transition in custom.css does the easing).
      dull(stepped ? p.target : p.cur)
    }
    // Stepped: the vertical grid lines along the tiles on screen, for the backdrop to
    // light while the tiles rest (`locked`), or none while they move.
    const announce = (locked) => {
      const sec = nav.current?.closest('.section')
      if (!sec || !stepped) return
      const xs = []
      if (locked && spots && strip) {
        const from = strip.fadeTo ?? 0
        for (const t of spots) {
          if (!t) continue
          const x = t.x - p.cur
          if (x < from - 1 || x + t.s > window.innerWidth + 1) continue
          for (let k = 0; k <= t.n; k++) xs.push({ x: x + k * t.cell, y0: t.y, y1: t.y + t.sh, edge: k === 0 || k === t.n })
        }
      }
      sec.dispatchEvent(new CustomEvent('grid:columns', { detail: xs }))
    }
    if (!open && keep && max > 0) {
      // Closed because one of the tiles is open: stay scrolled where we are.
      goBy.current = null
      wasOpen.current = false
      return undefined
    }
    if (!open || max <= 0) {
      p.cur = p.target = 0 // closed (or everything fits): back to the start
      apply()
      announce(open && max <= 0 && !!spots) // everything fits: the tiles are at rest where they are
      setShift(0)
      setNear(0)
      setEnds(0)
      goBy.current = null
      wasOpen.current = false
      return undefined
    }
    const clamp = (v) => Math.min(max, Math.max(0, v))
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = 0
    let idle = 0
    let hold = 0 // stepped: the timer for the hold after a step
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const d = p.target - p.cur
      if (instant || Math.abs(d) < 0.3) {
        p.cur = p.target
        apply()
        raf = 0
        setShift(Math.round(p.cur / step))
        announce(true) // locked into place
        return
      }
      p.cur += d * (1 - Math.exp(-dt * 12))
      apply()
      raf = requestAnimationFrame(tick)
    }
    const go = (target) => {
      p.target = clamp(target)
      setNear(Math.round(p.target / page) * page)
      setEnds((p.target > 0.5 ? 1 : 0) | (p.target < max - 0.5 ? 2 : 0))
      if (Math.abs(p.target - p.cur) >= 0.3) announce(false) // on the move: the lights go out
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }
    const rest = () => go(Math.round(p.target / snap) * snap)
    // Just opened: start two columns to the right, so the tiles slide in from that side.
    if (!wasOpen.current && !instant) p.cur = p.target - 2 * step
    wasOpen.current = true
    go(Math.round(p.target / snap) * snap) // after a resize: still on the grid, still in range
    goBy.current = (dir) => go(Math.round((p.target + dir * page) / snap) * snap)

    // Stepped: a screen's worth of columns along (dir 1) or back (-1), so the columns
    // now showing all leave and the next ones land where they stood, the first of them
    // where the first tile stood at the start. From somewhere between columns (after a
    // resize or a clamp at the end), the step counts from the next column that way.
    const stepTo = (dir) => {
      if (!stops?.length) return
      const at = p.target + stops[0] // the x of whatever column stands at the first tile's place
      let k = stops.findIndex((x) => Math.abs(x - at) < 1)
      if (k < 0) {
        const after = stops.findIndex((x) => x > at)
        k = dir > 0 ? (after < 0 ? stops.length : after) - 1 : after < 0 ? stops.length : after
      }
      go(stops[Math.min(stops.length - 1, Math.max(0, k + dir * stepCols))] - stops[0])
    }
    // Stepped: wheel travel adds up until it asks for a step; then the tiles hold, and
    // the rest of the gesture is ignored, so a flick's coasting can't take a second step.
    let pull = 0
    let lastAt = 0
    let prev = 0 // the last event's delta
    let axis = 'y' // the axis the current gesture started on
    let done = false // this gesture has had its step
    let holding = false
    let floor = Infinity // the smallest event since the step: where the coasting has got down to
    const stepHold = (dir) => {
      stepTo(dir)
      holding = true
      hold = setTimeout(() => {
        holding = false
      }, STEPPED.hold)
    }
    const onWheel = (e) => {
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerWidth : 1
      if (stops) {
        const now = performance.now()
        const paused = now - lastAt > STEPPED.gap
        if (paused) axis = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y' // the gesture keeps its first axis
        const delta = (axis === 'x' ? e.deltaX : e.deltaY) * unit
        if (Math.abs(delta) < 0.5) return // the tail end of a coast: nothing to read
        const a = Math.abs(delta)
        if (done) {
          const fresh = !holding && (paused || (prev && Math.sign(delta) !== Math.sign(prev)) || (a >= STEPPED.swipe && a > floor * STEPPED.above))
          if (!fresh) {
            floor = Math.min(floor, a)
            lastAt = now
            prev = delta
            return
          }
          done = false
          pull = 0
        }
        lastAt = now
        prev = delta
        pull += delta
        if (Math.abs(pull) < STEPPED.pull) return
        const dir = pull > 0 ? 1 : -1
        pull = 0
        done = true
        floor = Infinity
        stepHold(dir)
        return
      }
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit
      go(p.target + delta)
      clearTimeout(idle)
      idle = setTimeout(rest, 160)
    }
    // Swipe: the tiles follow the finger (sideways, or up/down like a wheel), and letting
    // go carries on to the next resting place in that direction.
    let touch = null
    const onTouchStart = (e) => {
      const t = e.touches[0]
      touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, from: p.target, moved: 0 } : null
    }
    const onTouchMove = (e) => {
      if (!touch) return
      const dx = touch.x - e.touches[0].clientX
      const dy = touch.y - e.touches[0].clientY
      touch.moved = Math.abs(dx) > Math.abs(dy) ? dx : dy
      // A finger wobbles a little during a tap: under TAP_SLOP it is still a tap, so the
      // tiles stay put and the tile under the finger opens.
      if (Math.abs(touch.moved) < TAP_SLOP && !touch.dragging) return
      touch.dragging = true
      draggedAt.current = performance.now()
      go(touch.from + touch.moved)
    }
    const onTouchEnd = () => {
      if (!touch) return
      const m = touch.moved
      const dragged = touch.dragging
      touch = null
      if (!dragged) return
      const at = p.target / snap
      go((Math.abs(m) > 30 ? (m > 0 ? Math.ceil(at) : Math.floor(at)) : Math.round(at)) * snap)
    }
    const onKey = (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const dir = e.key === 'ArrowRight' ? 1 : -1
      if (stops) return stepTo(dir)
      go((Math.round(p.target / snap) + dir) * snap)
    }
    // A tile reached with the Tab key while it is off the page: bring it on.
    const onFocus = (e) => {
      const el = e.target.closest?.('.project_thumb')
      if (!el || !el.matches(':focus-visible')) return
      const x = parseFloat(el.style.getPropertyValue('--x')) - p.target
      const from = strip?.fadeTo ?? 0
      if (x < from || x + el.offsetWidth > window.innerWidth) go(Math.round((x + p.target - from) / snap) * snap)
    }
    const el = nav.current
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    window.addEventListener('keydown', onKey)
    el?.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(idle)
      clearTimeout(hold)
      announce(false)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      el?.removeEventListener('focusin', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keep, max, snap, step, page, stopsKey, stepCols, strip?.fadeTo])

  // While closed with an item open: if the open item changes (swiped to the next one),
  // move to the screen that item's tile is on, so going back lands beside it.
  useEffect(() => {
    if (focus == null || open || max <= 0) return
    const per = strip?.per ?? (strip?.cols != null ? MAX_PER_SCREEN.desktop : MAX_PER_SCREEN.phone)
    const to = Math.min(max, Math.floor(focus / per) * page)
    pos.current.cur = pos.current.target = to
    if (track.current) track.current.style.transform = to ? `translate3d(${-to}px, 0, 0)` : ''
    dull(to)
    setNear(to)
    setShift(Math.round(to / step))
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Idle hint: while the tiles are open and nothing has been pressed for IDLE_HINT.every
  // seconds, one tile on screen gives a small hop, then another after the same wait, to
  // show the tiles are there to be opened. Any press, key or scroll starts the wait again.
  useEffect(() => {
    const el = nav.current
    if (!open || !el || !IDLE_HINT.enabled) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let timer = 0
    let last = null
    const hop = () => {
      const onScreen = [...el.querySelectorAll('.project_thumb')].filter((t) => {
        const r = t.getBoundingClientRect()
        return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth && !t.matches(':hover, :focus-visible')
      })
      const pool = onScreen.length > 1 ? onScreen.filter((t) => t !== last) : onScreen
      const tile = pool[Math.floor(Math.random() * pool.length)]
      if (tile && !el.querySelector('.project_thumb:hover')) {
        last = tile
        const up = -IDLE_HINT.height * tile.offsetHeight
        tile.animate(
          [
            { translate: '0 0', easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
            { translate: `0 ${up}px`, offset: 0.3, easing: 'cubic-bezier(0.5, 0, 0.8, 0.6)' },
            { translate: '0 0', offset: 0.58, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
            { translate: `0 ${up * 0.3}px`, offset: 0.78, easing: 'cubic-bezier(0.5, 0, 0.8, 0.6)' },
            { translate: '0 0' },
          ],
          { duration: IDLE_HINT.seconds * 1000 },
        )
      }
      timer = setTimeout(hop, IDLE_HINT.every * 1000)
    }
    const restart = () => {
      clearTimeout(timer)
      timer = setTimeout(hop, IDLE_HINT.every * 1000)
    }
    restart()
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, restart, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, restart))
    }
  }, [open])

  const scatter = Array.isArray(spots)
  // Desktop, when scrollable: tiles fade out across the clear column beside the panel.
  const fade = scatter && max > 0 && strip?.fadeTo != null
  const bouncing = bounce && BOUNCE.enabled
  // Per tile: how far it hops (fractions of a cell) and how much it tips, fixed for the page load.
  const hops = useRef(null)
  if (bouncing && (!hops.current || hops.current.length !== items.length)) {
    const rnd = mulberry32(seed.current + 1)
    hops.current = items.map(() => ({
      x: (rnd() - 0.5) * 0.16,
      y: -(0.1 + rnd() * 0.14),
      r: (rnd() - 0.5) * 6,
    }))
  }
  return (
    <nav
      ref={nav}
      className={`project_thumbs${scatter ? ' project_thumbs--scatter' : ''}${grow ? '' : ' project_thumbs--still'}${bouncing ? ' project_thumbs--bounce' : ''}${fade ? ' project_thumbs--fade' : ''}${open ? ' is-open' : closing ? ' is-closing' : ''}`}
      style={{
        ...(bouncing ? { '--bounce-beat': `${BEAT}s`, '--bounce-beats': BEATS } : null),
        ...(fade ? { '--fade-from': `${strip.fadeFrom}px`, '--fade-to': `${strip.fadeTo}px` } : null),
        ...(opacity != null ? { '--thumb-opacity': opacity } : null), // tiles at rest (custom.css)
        ...(dim != null ? { '--thumb-opacity-dim': dim } : null), // the others while one is hovered
      }}
      aria-label={label}
      aria-hidden={!open}
    >
      <div ref={track} className="project_thumbs_track">
        {items.map((p, i) => {
          const spot = scatter ? spots[i] : null
          if (scatter && !spot) return null
          if (spot && max > 0 && (spot.x < near - 2 * page || spot.x > near + 3 * page)) return null
          // Entrance order within the tile's own screen, so a tile far down a long list
          // does not wait seconds before fading in.
          const order = i % (strip?.per ?? MAX_PER_SCREEN.desktop)
          const style = spot
            ? {
                '--i': order,
                '--x': `${spot.x}px`,
                '--y': `${spot.y}px`,
                '--s': `${spot.s}px`,
                '--sh': `${spot.sh ?? spot.s}px`,
                // Desktop: a tile in the last column on screen grows leftward instead.
                '--cell': `${spot.cell ?? 0}px`,
                '--cell-y': `${spot.cellY ?? 0}px`,
                '--dx': `${spot.col != null && strip?.cols != null && spot.col - shift + spot.n + 1 > strip.cols ? -spot.cell : spot.dx}px`,
                '--dy': `${spot.dy}px`,
              }
            : { '--i': order }
          if (bouncing) {
            const h = hops.current[i]
            Object.assign(style, {
              '--bx': h.x,
              '--by': h.y,
              '--br': `${h.r}deg`,
            })
          }
          return (
            <a
              key={p.slug ?? p.id}
              href={external ? p.url : `/projects/${p.slug}`}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className={`project_thumb${rows ? ' project_thumb--grid' : ''}${rows && p.thumbGlass ? ' project_thumb--glass' : ''}`}
              aria-label={titles ? undefined : p.title}
              style={style}
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                if (performance.now() - draggedAt.current < 400) return e.preventDefault() // end of a swipe, not a tap
                if (external || !onSelect) return
                e.preventDefault()
                onSelect(p, e)
              }}
              // Hover clip: the whole tile (glass margin included) starts and stops it, the
              // same area as the hover opacity in custom.css. Mouse only: a finger never starts
              // it (on phones the clip plays by itself while the tile is on screen; above).
              onPointerEnter={(e) => {
                if (e.pointerType !== 'mouse') return
                const v = e.currentTarget.querySelector('.project_thumb_hover')
                if (!v) return
                v.currentTime = 0
                v.play().catch(() => {})
                showClip(v)
              }}
              onPointerLeave={(e) => {
                const v = e.currentTarget.querySelector('.project_thumb_hover')
                if (v) stopClip(v)
              }}
            >
              <span className="project_thumb_media">
                {p.thumb?.image || p.image ? <img src={p.thumb?.image || p.image} alt="" loading="lazy" /> : null}
                {/* Hover clip (thumb-hover.mp4 in the project folder): a few seconds of the
                    project's video, over the still, while the mouse is on the tile (the
                    tile's pointer handlers above; custom.css .project_thumb_hover), or on
                    phones while the tile is on screen. */}
                {p.thumb?.hover && (
                  <video className={`project_thumb_hover${p.thumb.hover.alpha ? ' project_thumb_hover--alpha' : ''}`} muted loop playsInline preload={CAN_HOVER ? 'auto' : 'none'} disablePictureInPicture>
                    {/* A transparent clip comes as a pair; only one plays with its alpha in each
                        browser (Safari the HEVC .mp4, the rest the VP9 .webm), so pick it here
                        rather than leave the browser to take the first it can decode. */}
                    {p.thumb.hover.alpha ? (
                      <source src={SAFARI ? p.thumb.hover.mp4 : p.thumb.hover.webm} type={SAFARI ? 'video/mp4' : 'video/webm'} />
                    ) : (
                      <>
                        {p.thumb.hover.webm && <source src={p.thumb.hover.webm} type="video/webm" />}
                        {p.thumb.hover.mp4 && <source src={p.thumb.hover.mp4} type="video/mp4" />}
                      </>
                    )}
                  </video>
                )}
              </span>
              {p.lock && (
                <span className="project_thumb_lock" aria-label="Password protected">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5.5" y="10.5" width="13" height="9" rx="1" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                  </svg>
                </span>
              )}
              {titles && (
                <span className="project_thumb_title">
                  {p.title}
                  {/* The project's categories (`tags` in src/data/projects.js), under its name. */}
                  {Array.isArray(p.tags) && p.tags.some((t) => TAG_LABELS[t]) && (
                    <span className="project_thumb_tags">
                      {p.tags.filter((t) => TAG_LABELS[t]).map((t) => (
                        <span key={t} className="project_thumb_tag">
                          {TAG_LABELS[t]}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
            </a>
          )
        })}
      </div>
      {scatter &&
        max > 0 &&
        strip?.arrows &&
        [-1, 1].map((dir) => {
          const on = open && !!(ends & (dir < 0 ? 1 : 2))
          const a = strip.arrows
          const text = arrowLabels?.[dir < 0 ? 0 : 1]
          // The arrow keeps its cell; a label makes the button grow inward from that cell
          // (the right one is anchored by its right edge for that).
          const place = dir < 0 ? { left: a.left } : { right: `calc(100% - ${a.right + a.w}px)` }
          return (
            <button
              key={dir}
              type="button"
              className={`project_thumbs_arrow${on ? ' is-on' : ''}`}
              style={{ ...place, top: a.y, minWidth: a.w, height: a.h, '--dir': dir }}
              aria-label={`${dir < 0 ? 'Previous' : 'More'} ${label.toLowerCase()}${text ? ` (${text})` : ''}`}
              tabIndex={on ? 0 : -1}
              onClick={() => goBy.current?.(dir)}
            >
              {text && dir > 0 && <span className="project_thumbs_arrow_label">{text}</span>}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={dir < 0 ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
              </svg>
              {text && dir < 0 && <span className="project_thumbs_arrow_label">{text}</span>}
            </button>
          )
        })}
    </nav>
  )
}
