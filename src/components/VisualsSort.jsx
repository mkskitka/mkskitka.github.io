import { useEffect, useRef, useState } from 'react'
import { SORTS } from '../lib/sortItems.js'

/**
 * The tools in the top right corner of the page while the Visuals or Systems tiles are
 * open, in the first grid row (which the tiles keep clear, so the bar needs no backing
 * of its own): the two layout icons, then two dropdowns.
 *
 *   Show: which of the set are shown (All, or a subset: AI, Web...). `subsets` is the
 *         list on offer, `subset` the current one's id, `onSubset(id)` picks. With
 *         nothing but All to offer the dropdown is left out.
 *   Sort: the order they are put in (src/lib/sortItems.js). `value` is the current
 *         order's id, `rev` whether it is flipped; `onChange(id)` is called with the
 *         picked one. Every order but Shuffle runs between two ends (Dark → Light);
 *         picking the one already active flips it (Light → Dark), which the flip
 *         arrows on that row say.
 *
 * Clicking a dropdown drops its list (glass, since the tiles do pass behind that), two
 * options per grid row, so the list stays on the lattice. Only one list is open at a
 * time. Clicking elsewhere or pressing Escape closes it (Escape with the lists closed
 * still closes the tiles, as everywhere else on the page).
 *
 * `kind`: which tiles these are for, 'visuals' (default) or 'systems' (the project tiles).
 * `open`: those tiles are showing (the tools fade with them).
 * `layout` ('grid' | 'scatter') adds the two layout icons to the left of the dropdowns;
 * `onLayout(id)` is called with the picked one. `onListOpen(which)` reports the list
 * that is open ('show' | 'sort') or null.
 */
// The two layout icons: a grid (tiles in rows) and a scatter (tiles at random spots).
// `layout` is the current one; `onLayout(id)` picks.
const LAYOUTS = [
  { id: 'grid', label: 'Grid', icon: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /> },
  { id: 'scatter', label: 'Random positions', icon: <path d="M3 5h5v5H3zM13 3h5v5h-5zM7 14h5v5H7zM16 13h5v5h-5z" /> },
]
const FLIP = <path d="M8 4v16M8 4 5 7m3-3 3 3M16 20V4m0 16 3-3m-3 3-3-3" />
const RESHUFFLE = <path d="M4 7h4l8 10h4M4 17h4l1.5-1.9M14.5 8.9 16 7h4M18 5l2 2-2 2M18 15l2 2-2 2" />

// One dropdown: the button in the bar (`prefix` then the current option) and the list
// that hangs from it. `options`: [{ id, label, title?, icon? }]; `icon` (an svg path)
// is drawn at the right of the active row, as a hint of what picking it again does.
function Dropdown({ prefix, name, options, value, isOpen, onToggle, onPick, tabbable }) {
  const current = options.find((o) => o.id === value) ?? options[0]
  return (
    <div className={`visuals_sort_main${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="visuals_sort_button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label={`${name}: ${current.label}`} tabIndex={tabbable ? 0 : -1} onClick={onToggle}>
        <span className="visuals_sort_prefix">{prefix}</span>
        <span className="visuals_sort_value">{current.label}</span>
        <svg className="visuals_sort_chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9.5 12 15.5 18 9.5" />
        </svg>
      </button>
      <ul className="visuals_sort_list" role="listbox" aria-label={name}>
        {options.map((o) => (
          <li key={o.id} role="option" aria-selected={o.id === value}>
            <button type="button" className={`visuals_sort_option${o.id === value ? ' is-active' : ''}`} tabIndex={tabbable && isOpen ? 0 : -1} title={o.title} onClick={() => onPick(o.id)}>
              {o.label}
              {o.icon && (
                <svg className="visuals_sort_flip" viewBox="0 0 24 24" aria-hidden="true">
                  {o.icon}
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function VisualsSort({ kind = 'visuals', open = false, value, rev = false, onChange, subsets = null, subset = 'all', onSubset = null, layout = null, onLayout = null, onListOpen = null }) {
  const root = useRef(null)
  const [openList, setOpenList] = useState(null) // 'show' | 'sort' | null
  const what = kind === 'systems' ? 'projects' : kind
  const labelFor = (s, flipped) => (flipped && s.flipped ? s.flipped : s.label)
  // The orders as the dropdown shows them: the active one reads the way it currently
  // runs, and carries the hint of what picking it again does.
  const orders = SORTS[kind].map((s) => {
    const active = s.id === value
    return {
      id: s.id,
      label: labelFor(s, active && rev),
      title: active ? (s.flipped ? `Flip to ${labelFor(s, !rev)}` : s.id === 'shuffle' ? 'Shuffle again' : undefined) : undefined,
      icon: active ? (s.flipped ? FLIP : RESHUFFLE) : null,
    }
  })

  useEffect(() => {
    if (!open) setOpenList(null)
  }, [open])
  // Tell the page which list is showing (the tiles behind it are dulled).
  useEffect(() => {
    onListOpen?.(open ? openList : null)
  }, [openList, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // A press anywhere outside closes the list.
  useEffect(() => {
    if (!openList) return undefined
    const onDown = (e) => {
      if (!root.current?.contains(e.target)) setOpenList(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [openList])

  const toggle = (which) => () => setOpenList((o) => (o === which ? null : which))
  const pick = (fn) => (id) => {
    setOpenList(null)
    fn?.(id)
  }

  return (
    <div
      ref={root}
      className={`visuals_sort${open ? ' is-shown' : ''}${openList ? ' is-open' : ''}`}
      aria-hidden={!open}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !openList) return
        e.stopPropagation() // this Escape is for the list, not the tiles
        setOpenList(null)
      }}
    >
      {layout && (
        <div className="visuals_sort_layout" role="group" aria-label={`Layout of the ${what}`}>
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`visuals_sort_icon${layout === l.id ? ' is-active' : ''}`}
              aria-label={l.label}
              aria-pressed={layout === l.id}
              title={l.label}
              tabIndex={open ? 0 : -1}
              onClick={() => onLayout?.(l.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">{l.icon}</svg>
            </button>
          ))}
        </div>
      )}
      {subsets?.length > 1 && <Dropdown prefix="Show" name={`Show ${what}`} options={subsets} value={subset} isOpen={openList === 'show'} onToggle={toggle('show')} onPick={pick(onSubset)} tabbable={open} />}
      <Dropdown prefix="Sort" name={`Sort ${what}`} options={orders} value={value} isOpen={openList === 'sort'} onToggle={toggle('sort')} onPick={pick(onChange)} tabbable={open} />
    </div>
  )
}
