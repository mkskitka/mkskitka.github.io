import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { projects } from '../data/projects.js'
import { phoneSpots } from '../lib/phoneTiles.js'
import { BOUNCE } from './GridInkBackdrop.jsx'

/**
 * Scattered tiles, used for Systems (projects; click opens the project view) and
 * Visuals (`items` + `external`: each tile links out in a new tab).
 * One square per item, TILE_CELLS backdrop cells across, scattered over random
 * grid cells beside the menu panel (never overlapping, always on the
 * lines, chosen once per page load). Hovering a tile grows it by one cell each way,
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
 * downward. `sizes` ({ desktop: [min, max] }) gives the scatter layout tiles of mixed
 * sizes, each drawn at random between the two. `opacity` / `dim` set the tiles'
 * opacity at rest and the others' while one is hovered (custom.css --thumb-opacity,
 * --thumb-opacity-dim), for this set of tiles only. `grow` false turns off the hover
 * enlargement (the tile growing a cell and its image zooming), as on Systems.
 * `phoneRows` caps the rows of tiles under the panel on phones (Systems 2, Visuals 3).
 * `dimBehind`: the sort dropdown's list is open, so the tiles under it are dulled.
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
const SEEN_MIN = 0.12 // how visible a tile stays once it has slid behind the menu panel (1 = not dulled)
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

// The tiles' hop: one per beat, for about as long as the lines take to bounce and settle.
const BEAT = 60 / BOUNCE.bpm
const BEATS = Math.max(1, Math.round((BOUNCE.seconds + 0.6) / BEAT))

export default function ProjectThumbs({ open = false, onSelect, items = projects, label = 'Projects', external = false, bounce = false, titles = true, keep = false, focus = null, cells = TILE_CELLS, rows = false, columns = null, arrowLabels = null, sizes = null, opacity = null, dim = null, grow = true, phoneRows = null, dimBehind = false }) {
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
        const out = []
        for (let p = 0; p < screens; p++) {
          const placed = phoneSpots({
            count: Math.min(per, items.length - p * per),
            spacing: s,
            spacingY: psy,
            originX,
            originY: poy,
            width: section.clientWidth,
            height: pHeight - (screens > 1 && pHeight === section.clientHeight ? psy : 0), // the bottom row is the arrows'
            panelBottom,
            rnd,
            cells: pc,
            scatter: !rows, // rows: the centred lattice, filled in order
            shuffle: !rows,
            centered: rows,
            columns: pcolumns,
            centerX: pcolumns > 0,
            distinctRows: !rows, // scatter: every tile's top edge on a different grid line
            // The block sits centred between the panel and the screen's bottom (above
            // the arrows' row when scrollable), even when `phoneRows` caps its height.
            centerY: section.clientHeight - (screens > 1 ? psy : 0),
          })
          out.push(...placed.map((o) => o && { ...o, x: o.x + p * screenW }))
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
      // Everything on one screen if the lattice holds it; otherwise the bottom grid row
      // goes to the arrows and the lattice is sized on what is left.
      let maxRows = latticeRows(gridRows)
      if (rows && items.length > perRow * maxRows) maxRows = latticeRows(gridRows - 1)
      // `rows` as a number caps the rows (Systems: two), the rest going on further screens.
      if (typeof rows === 'number') {
        maxRows = Math.min(maxRows, rows)
        if (items.length > perRow * maxRows) maxRows = Math.min(rows, latticeRows(gridRows - 1))
      }
      // A scatter of mixed sizes holds fewer per screen: about what the area allows
      // for tiles of the average size, each with its clear cell around it.
      const avg = sizes?.desktop ? (sizes.desktop[0] + sizes.desktop[1]) / 2 + PAD : 0
      const per = rows ? perRow * maxRows : sizes?.desktop ? Math.max(3, Math.floor((span * Math.max(1, gridRows - 1)) / (avg * avg))) : MAX_PER_SCREEN.desktop
      const screens = Math.max(1, Math.ceil(items.length / per))
      const tileRows = screens > 1 ? gridRows - 1 : gridRows // when scrollable the bottom row is the arrows'
      const rowCount = Math.min(maxRows, Math.ceil(Math.min(per, items.length) / perRow))
      // The block of rows is centred on the whole page height (so it balances the menu
      // panel, not the space above the arrows), then kept clear of the arrows' row.
      const blockRows = rowCount * pitch - PAD
      const row0 = Math.max(0, Math.min(tileRows - blockRows, Math.floor((gridRows - blockRows) / 2))) // a half-row tie goes up, toward the menu panel
      // ...and centred (to the nearest column) between the panel and the right edge.
      const rowCols = Math.min(perRow, items.length) * pitch - PAD
      const col0 = Math.max(0, Math.floor((span - rowCols) / 2))
      const out = items.map((_, n) => {
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
          return { x: LX(i), y: LY(j), s: c * sx, sh: c * sy, cell: sx, cellY: sy, col: i, n: c, dx: 0, dy }
        }
        // c = tile size in cells: the wanted size first, then smaller if it will not fit.
        // With `sizes` ({ desktop: [min, max] }) each tile wants its own size, drawn at
        // random between the two (the same draw each time, from the seed).
        const want = sizes?.desktop ? sizes.desktop[0] + Math.floor(rnd() * (sizes.desktop[1] - sizes.desktop[0] + 1)) : dc
        for (let c = want; c >= 1; c--) {
          if (span < c || tileRows < c) continue
          for (let tries = 0; tries < 500; tries++) {
            const i = first + Math.floor(rnd() * (span - c + 1))
            const j = Math.floor(rnd() * (tileRows - c + 1))
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
  }, [items.length, tileCells.desktop, tileCells.phone, rows, columns?.phone, sizes?.desktop?.[0], sizes?.desktop?.[1], phoneRows])
  useEffect(() => {
    dull(pos.current.cur)
  }) // after every render: the tiles near the panel (or under the open list) get their --seen as soon as they exist

  // Desktop, when scrollable: a tile that has slid left past the menu panel's edge is
  // dulled (its --seen, which custom.css multiplies into the media and title opacity:
  // SEEN_MIN behind the panel, 1 fully clear of it, in between while crossing), so the
  // menu stays readable over it and half-hidden tiles do not pull the eye.
  // With `dimBehind` (the sort dropdown's list is open) the tiles under that list are
  // dulled too.
  const dull = (scrolled) => {
    const edge = strip?.fadeFrom
    if (!track.current) return
    const list = dimBehind ? document.querySelector('.visuals_sort.is-open .visuals_sort_list')?.getBoundingClientRect() : null
    if (edge == null && !list) return
    for (const el of track.current.querySelectorAll('.project_thumb')) {
      let seen = 1
      if (edge != null) {
        const x = parseFloat(el.style.getPropertyValue('--x')) - scrolled
        const w = parseFloat(el.style.getPropertyValue('--s')) || 1
        const clear = Math.min(1, Math.max(0, (x + w - edge) / w)) // the part of the tile right of the panel's edge
        seen = SEEN_MIN + (1 - SEEN_MIN) * clear
      }
      if (list) {
        const r = el.getBoundingClientRect()
        if (r.left < list.right && r.right > list.left && r.top < list.bottom && r.bottom > list.top) seen = Math.min(seen, SEEN_MIN)
      }
      el.style.setProperty('--seen', seen.toFixed(3))
    }
  }

  // Scrolling. Wheel / swipe / arrow keys move a target; the tiles ease toward it and,
  // once the input stops, come to rest on the grid.
  const max = strip?.max ?? 0
  const snap = strip?.snap ?? 1
  const step = strip?.step ?? 1
  const page = strip?.page ?? snap
  useEffect(() => {
    const p = pos.current
    const apply = () => {
      if (track.current) track.current.style.transform = p.cur ? `translate3d(${-p.cur}px, 0, 0)` : ''
      dull(p.cur)
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
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const d = p.target - p.cur
      if (instant || Math.abs(d) < 0.3) {
        p.cur = p.target
        apply()
        raf = 0
        setShift(Math.round(p.cur / step))
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

    const onWheel = (e) => {
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerWidth : 1
      go(p.target + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit)
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
      go((Math.round(p.target / snap) + (e.key === 'ArrowRight' ? 1 : -1)) * snap)
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
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      el?.removeEventListener('focusin', onFocus)
    }
  }, [open, keep, max, snap, step, page, strip?.fadeTo])

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
              className="project_thumb"
              aria-label={titles ? undefined : p.title}
              style={style}
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                if (performance.now() - draggedAt.current < 400) return e.preventDefault() // end of a swipe, not a tap
                if (external || !onSelect) return
                e.preventDefault()
                onSelect(p, e)
              }}
            >
              <span className="project_thumb_media">
                {p.thumb?.video ? (
                  <video autoPlay muted loop playsInline preload="metadata" poster={p.thumb.video.poster}>
                    {p.thumb.video.webm && <source src={p.thumb.video.webm} type="video/webm" />}
                    {p.thumb.video.mp4 && <source src={p.thumb.video.mp4} type="video/mp4" />}
                  </video>
                ) : p.thumb?.image || p.image ? (
                  <img src={p.thumb?.image || p.image} alt="" loading="lazy" />
                ) : null}
              </span>
              {p.lock && (
                <span className="project_thumb_lock" aria-label="Password protected">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5.5" y="10.5" width="13" height="9" rx="1" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                  </svg>
                </span>
              )}
              {titles && <span className="project_thumb_title">{p.title}</span>}
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
