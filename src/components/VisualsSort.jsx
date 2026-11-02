import { useEffect, useRef, useState } from 'react'
import { SORTS } from '../lib/sortItems.js'

/**
 * The Visuals sort dropdown: a small glass button at the top right of the hero, on the
 * grid row the menu panel starts on, showing the current order. Clicking it drops a
 * list of the orders (src/lib/sortItems.js), one grid row each, so the list stays on
 * the lattice. Clicking elsewhere or pressing Escape closes the list (Escape with the
 * list closed still closes the tiles, as everywhere else on the page).
 *
 * `open`: the Visuals tiles are showing (the control fades with them).
 * `value`: the current order's id; `onChange(id)` is called with the picked one.
 */
export default function VisualsSort({ open = false, value, onChange }) {
  const root = useRef(null)
  const [listOpen, setListOpen] = useState(false)
  const options = SORTS.visuals
  const current = options.find((s) => s.id === value) ?? options[0]

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
        aria-label={`Sort visuals: ${current.label}`}
        tabIndex={open ? 0 : -1}
        onClick={() => setListOpen((o) => !o)}
      >
        <span className="visuals_sort_prefix">Sort</span>
        <span className="visuals_sort_value">{current.label}</span>
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
              onClick={() => {
                setListOpen(false)
                onChange?.(s.id)
              }}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
