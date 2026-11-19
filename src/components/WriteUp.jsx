import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { isStacked } from '../lib/layout.js'

// [text](/path) in a paragraph becomes a link: a site route (Link) or, with http(s), an <a>.
const rich = (text) =>
  String(text ?? '')
    .split(/(\[[^\]]+\]\([^)\s]+\))/)
    .map((part, i) => {
      const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (!m) return part
      return /^https?:/.test(m[2]) ? <a key={i} href={m[2]}>{m[1]}</a> : <Link key={i} to={m[2]}>{m[1]}</Link>
    })

/**
 * A glass write-up panel beside the hero menu (same frosted glass as the menu panel,
 * aligned to the backdrop grid). Used for the MK SKITKA bio and for the open
 * project's description. `lines` is a list of label/value rows shown above the
 * paragraphs (e.g. Role, Mediums); either may be empty.
 *
 * Only the paragraphs scroll when there is more than fits: the heading and `lines` stay
 * at the top and `children` (the project gallery) at the bottom. On phones the heading
 * scrolls away with the text (the screen is short), and the panel is capped to the
 * space under the menu.
 * Desktop width is a whole number of grid cells: up to --writeup-cells (custom.css),
 * but never more than fit between the menu panel and the right edge. If fewer than
 * MIN_CELLS fit (a long project title makes the panel wide), the write-up drops to
 * the row of cells under the panel instead.
 *
 * `align` says where it sits in the space between the menu panel and the right edge,
 * always on grid lines: 'left' (one gap column after the panel), 'center' (the same
 * number of empty columns either side; the width goes a cell wider or narrower when
 * that is what it takes to be exactly centred) or 'right' (one gap column from the
 * right edge).
 *
 * `anchor="bottom"` (project write-ups): on an upright tablet the panel sits one grid
 * row above the bottom of the page instead of straight under the menu, so the project
 * image shows between the title and the text; it grows upward as far as one row under
 * the menu panel, then scrolls. `anchor="center"` (the bio): on an upright tablet it is
 * centred down the space between the bottom of the menu panel and the bottom of the
 * page, with at least a grid row clear above and below. Beside the menu (desktop) it is
 * centred down the whole page instead, on the grid: a whole number of rows tall (its
 * text centred inside) and starting on a row line, at least a row clear of the page's
 * top and bottom.
 */
const MIN_CELLS = 4
const PHONE_BOTTOM_GAP = 24 // px left below the panel on phones
const TABLET_QUERY = '(min-width: 768px)' // stacked and this wide: an upright tablet (lib/layout.js)

export default function WriteUp({ open = false, heading, lines = [], paragraphs = [], align = 'left', anchor = 'top', children }) {
  const ref = useRef(null)
  const [place, setPlace] = useState(null) // { cells, below } or null (phones / not measured)

  useLayoutEffect(() => {
    const el = ref.current
    const section = el?.closest('.section')
    if (!el || !section || !open) return undefined
    const measure = () => {
      if (isStacked() && anchor !== 'top' && window.matchMedia(TABLET_QUERY).matches) {
        const sy = parseFloat(getComputedStyle(section).getPropertyValue('--grid-spacing-y')) || 64
        const panel = section.querySelector('.header.margin-bottom_none')
        const panelBottom = panel ? panel.getBoundingClientRect().bottom - section.getBoundingClientRect().top : 0
        const maxHeight = Math.max(140, Math.floor(section.clientHeight - panelBottom - 2 * sy))
        setPlace(anchor === 'center' ? { phone: true, center: panelBottom, maxHeight } : { phone: true, bottom: sy, maxHeight })
        return
      }
      if (isStacked()) {
        // Phones: the page does not scroll, so cap the panel at the space left under
        // the menu and let it scroll inside instead of running off the bottom.
        const secRect = section.getBoundingClientRect()
        const top = el.getBoundingClientRect().top - secRect.top
        const avail = section.clientHeight - top - PHONE_BOTTOM_GAP
        setPlace({ phone: true, maxHeight: Math.max(140, Math.round(avail)) })
        return
      }
      const cs = getComputedStyle(section)
      const s = parseFloat(cs.getPropertyValue('--grid-spacing')) || 64
      const want = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--writeup-cells')) || 7
      const panel = section.querySelector('.header.margin-bottom_none')
      const secRect = section.getBoundingClientRect()
      const pr = panel ? panel.getBoundingClientRect() : null
      const panelRight = pr ? pr.right - secRect.left : 0
      const panelBottom = pr ? pr.bottom - secRect.top : 0
      const fit = Math.floor((secRect.width - panelRight - s) / s) // cells to the right, after one gap column
      // Tallest the panel may be: from where it sits to one gap row above the page bottom.
      const capFrom = (top) => Math.max(160, Math.floor(secRect.height - top - s))
      if (fit >= MIN_CELLS) {
        let cells = Math.min(want, fit)
        // Whole columns between the panel's right edge and the last grid line on screen.
        const ox = parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0
        const lastLine = ox + Math.floor((secRect.width - ox) / s + 1e-6) * s
        const free = Math.max(cells + 1, Math.round((lastLine - panelRight) / s))
        let gap = 1 // empty columns between the panel and the write-up
        if (align === 'right') gap = Math.max(1, free - cells - 1)
        else if (align === 'center') {
          if ((free - cells) % 2) cells += free - cells - 1 >= 2 ? 1 : -1 // same gap both sides
          gap = Math.max(1, (free - cells) / 2)
        }
        if (anchor === 'center') {
          // Rows: the fewest whole rows that hold the text (measured at this width with
          // the panel's own size lifted for a moment) with at least MIN_PAD_ROWS of glass
          // above and below it, and the same number of rows left clear above and below
          // the panel, so it is centred on the page with its edges on row lines. The
          // glass's top and bottom padding takes up what is left, so the text sits in
          // the middle of it. At most the page's rows less one clear row at each end
          // (more text than that scrolls).
          const MIN_PAD_ROWS = 0.25
          const sy = parseFloat(cs.getPropertyValue('--grid-spacing-y')) || s
          const oy = parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0
          const totalRows = Math.floor((secRect.height - oy) / sy + 1e-6)
          const keep = { width: el.style.width, height: el.style.height, maxHeight: el.style.maxHeight, paddingTop: el.style.paddingTop, paddingBottom: el.style.paddingBottom }
          Object.assign(el.style, { width: `calc(${cells * s}px - 2 * var(--glass-gap))`, height: 'auto', maxHeight: 'none', paddingTop: '0px', paddingBottom: '0px' })
          const text = el.offsetHeight // the content alone, no vertical padding
          Object.assign(el.style, keep)
          const maxRows = Math.max(1, totalRows - 2)
          let rows = Math.ceil(text / sy + 2 * MIN_PAD_ROWS - 1e-3)
          if ((totalRows - rows) % 2) rows += 1 // same number of clear rows above and below
          rows = Math.min(rows, maxRows)
          const topRow = Math.floor((totalRows - rows) / 2)
          const pad = Math.max(sy * MIN_PAD_ROWS, (rows * sy - text) / 2)
          // Margin that puts the top on that row line (from where the panel sits now).
          // The opening animation slides the panel up from translateY(12px), so the
          // on-screen top is measured without whatever slide is still in progress;
          // otherwise the first measure lands the panel that far too high.
          const ecs = getComputedStyle(el)
          const margin = parseFloat(ecs.marginTop) || 0
          const slide = ecs.transform && ecs.transform !== 'none' ? new DOMMatrixReadOnly(ecs.transform).m42 : 0
          const shift = oy + topRow * sy - (el.getBoundingClientRect().top - slide - secRect.top)
          setPlace({ cells, gap, below: false, top: 0, centred: true, marginTop: margin + shift, height: rows * sy, pad })
          return
        }
        setPlace({ cells, gap, below: false, top: 0, maxHeight: capFrom(el.getBoundingClientRect().top - secRect.top) })
      }
      else {
        // Under the panel: left edge on the panel's left edge, one gap row below it.
        const pl = pr ? pr.left - secRect.left : s / 2
        const maxCells = Math.floor((secRect.width - pl - s / 2) / s)
        setPlace({ cells: Math.min(want + 2, maxCells), below: true, top: panelBottom + s, left: pl, maxHeight: capFrom(panelBottom + s) })
      }
    }
    measure()
    document.fonts?.ready.then(() => measure()) // the text wraps differently once the webfont is in
    const ro = new ResizeObserver(measure)
    ro.observe(section)
    const mo = new MutationObserver(measure)
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    const panelEl = section.querySelector('.header.margin-bottom_none')
    if (panelEl) mo.observe(panelEl, { childList: true, subtree: true, characterData: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [open, heading, align, anchor])

  const style = place?.phone
    ? place.bottom != null
      ? { position: 'absolute', left: 'var(--grid-spacing)', right: 'var(--grid-spacing)', bottom: `${place.bottom}px`, margin: 0, maxHeight: `${place.maxHeight}px` }
      : place.center != null
      ? // top/bottom span the free space; a content-tall box with auto margins sits in its middle
        { position: 'absolute', left: 'var(--grid-spacing)', right: 'var(--grid-spacing)', top: `${place.center}px`, bottom: 0, height: 'max-content', margin: 'auto 0', maxHeight: `${place.maxHeight}px` }
      : { maxHeight: `${place.maxHeight}px` }
    : place
    ? place.below
      ? { position: 'absolute', left: place.left, top: place.top, width: `calc(var(--grid-spacing) * ${place.cells})`, margin: 0, maxHeight: `${place.maxHeight}px` }
      : place.centred
      ? // the box is on the grid lines; the glass stops --glass-gap short of them on every side, so the lines show whole
        {
          width: `calc(var(--grid-spacing) * ${place.cells} - 2 * var(--glass-gap))`,
          marginLeft: `calc(var(--grid-spacing) * ${place.gap} + var(--glass-gap))`,
          marginTop: `calc(${place.marginTop}px + var(--glass-gap))`,
          height: `calc(${place.height}px - 2 * var(--glass-gap))`,
          maxHeight: 'none',
          paddingTop: `calc(${place.pad}px - var(--glass-gap))`,
          paddingBottom: `calc(${place.pad}px - var(--glass-gap))`,
          justifyContent: 'center',
        }
      : { width: `calc(var(--grid-spacing) * ${place.cells})`, marginLeft: `calc(var(--grid-spacing) * ${place.gap})`, maxHeight: `${place.maxHeight}px` }
    : undefined

  return (
    <aside ref={ref} className={`writeup${open ? ' is-open' : ''}`} aria-hidden={!open} style={style}>
      <div className="writeup_main">
      <div className="writeup_head">
      {heading && <h2 className="writeup_heading">{heading}</h2>}
      {lines.filter((l) => l.value).length > 0 && (
        <dl className="writeup_lines">
          {lines
            .filter((l) => l.value)
            .map((l) => (
              <div key={l.label} className="writeup_line">
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
        </dl>
      )}
      </div>
      <div className="writeup_body">
      {paragraphs.map((p, i) => (
        <p key={i}>{rich(p)}</p>
      ))}
      </div>
      </div>
      {children && <div className="writeup_foot">{children}</div>}
    </aside>
  )
}
