import { useEffect, useRef, useState } from 'react'
import { SORTS } from '../lib/sortItems.js'

/**
 * The Visuals sort dropdown: a small glass button in the top right corner of the page,
 * its bottom edge on the first grid line, showing the current order. Clicking it drops a
 * list of the orders (src/lib/sortItems.js), one grid row each, so the list stays on
 * the lattice. Clicking elsewhere or pressing Escape closes the list (Escape with the
 * list closed still closes the tiles, as everywhere else on the page).
 *
 * Every order but Shuffle runs between two ends (Dark → Light); picking the one
 * already active flips it (Light → Dark), which the flip arrows on that row say.
 *
 * `open`: the Visuals tiles are showing (the control fades with them).
 * `value`: the current order's id, `rev` whether it is flipped; `onChange(id)` is
 * called with the picked one (the active one again means flip).
 */
export default function VisualsSort({ open = false, value, rev = false, onChange }) {
  const root = useRef(null)
  const [listOpen, setListOpen] = useState(false)
  const options = SORTS.visuals
  const current = options.find((s) => s.id === value) ?? options[0]
  const labelFor = (s, flipped) => (flipped && s.flipped ? s.flipped : s.label)

  useEffect(() => {
    if (!open) setListOpen(false)
  }, [open])

  // A press anywhere outside closes the list.
  useEffect(() => {
    if (!listOpen) return undefined
    const onDown = (e) => {
      if (!root.current?.contains(e.target)) setListOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [listOpen])

  return (
    <div
      ref={root}
      className={`visuals_sort${open ? ' is-shown' : ''}${listOpen ? ' is-open' : ''}`}
      aria-hidden={!open}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !listOpen) return
        e.stopPropagation() // this Escape is for the list, not the tiles
        setListOpen(false)
      }}
    >
      <button
        type="button"
        className="visuals_sort_button"
        aria-haspopup="listbox"
        aria-expanded={listOpen}
        aria-label={`Sort visuals: ${labelFor(current, rev)}`}
        tabIndex={open ? 0 : -1}
        onClick={() => setListOpen((o) => !o)}
      >
        <span className="visuals_sort_prefix">Sort</span>
        <span className="visuals_sort_value">{labelFor(current, rev)}</span>
        <svg className="visuals_sort_chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9.5 12 15.5 18 9.5" />
        </svg>
      </button>
      <ul className="visuals_sort_list" role="listbox" aria-label="Sort visuals">
        {options.map((s) => (
          <li key={s.id} role="option" aria-selected={s.id === value}>
            <button
              type="button"
              className={`visuals_sort_option${s.id === value ? ' is-active' : ''}`}
              tabIndex={open && listOpen ? 0 : -1}
              title={s.id === value ? (s.flipped ? `Flip to ${labelFor(s, !rev)}` : 'Shuffle again') : undefined}
              onClick={() => {
                setListOpen(false)
                onChange?.(s.id)
              }}
            >
              {labelFor(s, s.id === value && rev)}
              {s.id === value && (
                <svg className="visuals_sort_flip" viewBox="0 0 24 24" aria-hidden="true">
                  {s.flipped ? <path d="M8 4v16M8 4 5 7m3-3 3 3M16 20V4m0 16 3-3m-3 3-3-3" /> : <path d="M4 7h4l8 10h4M4 17h4l1.5-1.9M14.5 8.9 16 7h4M18 5l2 2-2 2M18 15l2 2-2 2" />}
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
