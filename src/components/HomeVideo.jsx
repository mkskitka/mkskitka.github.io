import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { heroVideo } from '../data/videos.js'
import { LOAD_SECONDS } from './GridInkBackdrop.jsx'

/**
 * The hope_wide loop (src/data/videos.js) on the home page while nothing in the menu
 * is selected: a square (the 16:9 video cropped at the sides). On desktop it is a
 * block of the open space to the right of the menu panel, on grid lines and centred
 * in that space both ways: the same number of empty columns between it and the panel
 * as between it and the right edge, and the same number of empty rows above and
 * below; about the menu panel's width, up to MAX_CELLS columns. On phones
 * (PHONE_QUERY) it sits under the panel on its left edge, about the panel's width,
 * or as tall as the space under the panel allows if that is less. It fades out as soon as a menu
 * item is picked (`open` false).
 *
 * It holds on its poster frame and only plays while the pointer is over it (a tap
 * toggles it where there is no pointer); it pauses again when the pointer leaves
 * or the block is hidden.
 *
 * It stays hidden until the page-load animation (the grid lines growing across,
 * LOAD_SECONDS in GridInkBackdrop.jsx) has finished, then fades in.
 */
const AFTER_LOAD_MS = 250 // a beat after the lines have finished growing
const MAX_CELLS = 8
const MIN_CELLS = 4
const PHONE_QUERY = '(max-width: 767px)'
const INSET = 2 // px kept clear inside the grid lines on all four sides, so the lines stay visible around it

export default function HomeVideo({ open = false }) {
  const ref = useRef(null)
  const [place, setPlace] = useState(null)
  const [loaded, setLoaded] = useState(false) // the page-load line animation has finished
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), LOAD_SECONDS * 1000 + AFTER_LOAD_MS)
    return () => clearTimeout(t)
  }, [])
  const shown = open && loaded

  useLayoutEffect(() => {
    const el = ref.current
    const section = el?.closest('.section')
    if (!el || !section) return undefined
    const measure = () => {
      const cs = getComputedStyle(section)
      const s = parseFloat(cs.getPropertyValue('--grid-spacing')) || 64
      const sy = parseFloat(cs.getPropertyValue('--grid-spacing-y')) || s
      const panel = section.querySelector('.header.margin-bottom_none')
      const secRect = section.getBoundingClientRect()
      const pr = panel ? panel.getBoundingClientRect() : null
      const panelRight = pr ? pr.right - secRect.left : 0
      const panelTop = pr ? pr.top - secRect.top : 0
      const panelBottom = pr ? pr.bottom - secRect.top : 0
      const panelLeft = pr ? pr.left - secRect.left : s / 2
      const panelWidth = pr ? pr.width : 4 * s // the square is about the menu panel's size
      const phone = window.matchMedia(PHONE_QUERY).matches
      const fit = Math.floor((secRect.width - panelRight - s) / s)
      if (!phone && fit >= MIN_CELLS) {
        // Whole columns between the panel's right edge and the last grid line on screen,
        // and whole rows between the first grid line and the last; centre on both. The
        // square is `cells` columns wide and the nearest whole number of rows tall.
        const ox = parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0
        const oy = parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0
        const lastLine = ox + Math.floor((secRect.width - ox) / s + 1e-6) * s
        const free = Math.max(MIN_CELLS + 2, Math.round((lastLine - panelRight) / s))
        const totalRows = Math.floor((secRect.height - oy) / sy + 1e-6)
        let cells = Math.min(MAX_CELLS, free - 2, Math.floor(((totalRows - 2) * sy) / s), Math.max(3, Math.round(panelWidth / s))) // about the panel's width, and no taller than the rows allow
        if ((free - cells) % 2) cells -= 1 // same gap both sides
        cells = Math.max(2, cells)
        const gap = (free - cells) / 2
        const rows = Math.max(2, Math.round((cells * s) / sy))
        const top = oy + Math.floor((totalRows - rows) / 2) * sy
        setPlace({ left: panelRight + gap * s, top, width: cells * s, height: rows * sy })
      } else {
        // Phones: a square under the panel, one row below it, on the panel's left edge
        // and about the panel's width (whole rows), unless the space down to one row
        // above the page bottom is less; then that.
        const top = panelBottom + sy
        const avail = Math.max(120, Math.floor((secRect.height - top - sy) / sy) * sy)
        const side = Math.min(Math.max(120, Math.round(panelWidth / sy) * sy), avail)
        setPlace({ left: panelLeft, top, width: side, height: side })
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(section)
    const mo = new MutationObserver(measure)
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  const video = useRef(null)
  const play = () => {
    const v = video.current
    if (!v) return
    v.muted = true
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }
  const pause = () => video.current?.pause()
  // Hidden (a menu item picked): stop, so it is not running behind the tiles.
  useEffect(() => {
    if (!shown) pause()
  }, [shown])

  const style = place ? { left: place.left + INSET, top: place.top + INSET, width: place.width - 2 * INSET, height: place.height - 2 * INSET } : undefined
  return (
    <div
      ref={ref}
      className={`home_video${shown ? ' is-open' : ''}`}
      aria-hidden={!shown}
      style={style}
      onMouseEnter={play}
      onMouseLeave={pause}
      onTouchEnd={(e) => {
        if (e.cancelable) e.preventDefault()
        const v = video.current
        if (v) v.paused ? play() : pause()
      }}
    >
      <video ref={video} className="home_video_media" loop muted playsInline preload="metadata" poster={heroVideo.poster}>
        {heroVideo.mp4 && <source src={heroVideo.mp4} type="video/mp4" />}
        {heroVideo.webm && <source src={heroVideo.webm} type="video/webm" />}
      </video>
    </div>
  )
}
