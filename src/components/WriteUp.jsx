import { useLayoutEffect, useRef, useState } from 'react'

/**
 * A glass write-up panel beside the hero menu (same frosted glass as the menu panel,
 * aligned to the backdrop grid). Used for the MK SKITKA bio and for the open
 * project's description. `lines` is a list of label/value rows shown above the
 * paragraphs (e.g. Role, Mediums); either may be empty.
 *
 * On phones the panel is capped to the space under the menu and the text scrolls inside;
 * `children` (the project gallery) stays fixed at the bottom of the panel, outside the scroll.
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
 */
const MIN_CELLS = 4
const PHONE_BOTTOM_GAP = 24 // px left below the panel on phones

export default function WriteUp({ open = false, heading, lines = [], paragraphs = [], align = 'left', children }) {
  const ref = useRef(null)
  const [place, setPlace] = useState(null) // { cells, below } or null (phones / not measured)

  useLayoutEffect(() => {
    const el = ref.current
    const section = el?.closest('.section')
    if (!el || !section || !open) return undefined
    const measure = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) {
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
        setPlace({ cells, gap, below: false, top: 0 })
      }
      else {
        // Under the panel: left edge on the panel's left edge, one gap row below it.
        const pl = pr ? pr.left - secRect.left : s / 2
        const maxCells = Math.floor((secRect.width - pl - s / 2) / s)
        setPlace({ cells: Math.min(want + 2, maxCells), below: true, top: panelBottom + s, left: pl })
      }
    }
    measure()
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
  }, [open, heading, align])

  const style = place?.phone
    ? { maxHeight: `${place.maxHeight}px` }
    : place
    ? place.below
      ? { position: 'absolute', left: place.left, top: place.top, width: `calc(var(--grid-spacing) * ${place.cells})`, margin: 0 }
      : { width: `calc(var(--grid-spacing) * ${place.cells})`, marginLeft: `calc(var(--grid-spacing) * ${place.gap})` }
    : undefined

  return (
    <aside ref={ref} className={`writeup${open ? ' is-open' : ''}`} aria-hidden={!open} style={style}>
      <div className="writeup_body">
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
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      </div>
      {children && <div className="writeup_foot">{children}</div>}
    </aside>
  )
}
