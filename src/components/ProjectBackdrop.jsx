import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * A project's image behind the grid lines, revealed square by
 * square: the page is cut into the backdrop's grid cells and each cell shows its
 * own portion of the image, animating in within its bounds (a soft zoom-and-fade)
 * in a ripple that spreads out from the clicked tile. Closing fades the whole thing.
 *
 * Images are revealed in cells. A hero *video* is shown as one element with a plain
 * fade (hundreds of video elements would be too heavy).
 */
const RIPPLE_MS = 38 // delay per cell of distance from the clicked tile
const CELL_MS = 650 // how long each cell's own animation takes

// Depth: shade the edges of every cell so each grid square reads as a bevelled tile
// (the look the reveal's blur produced by accident). 0 = flat image.
export const DEPTH = {
  enabled: false,
  strength: 0, // how dark the edge shading gets (0..1)
  width: 0.58, // how far the shading reaches into the cell, as a fraction of the cell
  highlight: 0, // light catch on the top/left edges (0 = none)
}
// Phones: each animated piece is this many backdrop cells square (still on the grid
// lines). One cell per piece is ~350 animated layers on a phone, which stutters;
// 2x2 is ~90. Desktop keeps one cell per piece.
const PHONE_PIECE_CELLS = 2
const isPhone = () => window.matchMedia('(max-width: 767px)').matches

export default function ProjectBackdrop({ project, from, onClosed, host, fit = 'cover' }) {
  const [closing, setClosing] = useState(false)
  const [img, setImg] = useState(null) // { url, w, h }
  const [box, setBox] = useState({ w: 1, h: 1, s: 64 })
  // The reveal has finished: the cells are swapped for the image in one piece (below).
  const [settled, setSettled] = useState(false)

  const media = project?.hero?.video
    ? { video: project.hero.video }
    : project?.hero?.still
      ? { image: project.hero.still }
      : project?.thumb || null

  // Closing: fade out, then unmount.
  useEffect(() => {
    if (project) {
      setClosing(false)
      return undefined
    }
    setClosing(true)
    const t = setTimeout(() => onClosed?.(), 600)
    return () => clearTimeout(t)
  }, [project, onClosed])

  // Load the image to learn its size (needed for the cover maths).
  useEffect(() => {
    const url = media?.image
    if (!url) {
      setImg(null)
      return undefined
    }
    let alive = true
    const im = new Image()
    // Decode fully before the cells mount, so the first frames of the reveal are not
    // spent decoding the image on the main thread.
    im.onload = () => {
      const done = () => alive && setImg({ url, w: im.naturalWidth, h: im.naturalHeight })
      if (im.decode) im.decode().then(done, done)
      else done()
    }
    im.src = url
    return () => {
      alive = false
    }
  }, [media?.image])

  // Page size and grid spacing (the backdrop sketch publishes --grid-spacing on the section).
  useLayoutEffect(() => {
    const measure = () => {
      const el = host?.current
      if (!el) return
      const cs = getComputedStyle(el)
      const s = parseFloat(cs.getPropertyValue('--grid-spacing')) || 64
      const sy = parseFloat(cs.getPropertyValue('--grid-spacing-y')) || s
      const ox = parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0
      const oy = parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0
      setBox({ w: el.clientWidth, h: el.clientHeight, s, sy, ox, oy })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [host, project])

  // The cells, with their slice of the image and their ripple delay; `whole` is the
  // same image in one piece, and `doneMs` when the last cell has finished.
  const { cells, whole, doneMs } = useMemo(() => {
    if (!img) return { cells: [], whole: null, doneMs: 0 }
    const { w, h, s } = box
    const sy = box.sy ?? s
    // 'cover' fills the page and crops; 'contain' shows the whole image as large as it fits.
    const scale = fit === 'contain' ? Math.min(w / img.w, h / img.h) : Math.max(w / img.w, h / img.h)
    const bw = img.w * scale
    const bh = img.h * scale
    const ox = (w - bw) / 2
    const oy = (h - bh) / 2
    // Piece size: one cell, or a block of cells on phones. Pieces start on a grid line
    // (at or before the page edge) so every edge stays on a line.
    const n = isPhone() ? PHONE_PIECE_CELLS : 1
    const px = s * n
    const py = sy * n
    const startX = (box.ox ?? 0) - Math.ceil((box.ox ?? 0) / px) * px
    const startY = (box.oy ?? 0) - Math.ceil((box.oy ?? 0) / py) * py
    const cols = Math.ceil((w - startX) / px)
    const rows = Math.ceil((h - startY) / py)
    const origin = from
      ? { x: from.left + from.width / 2, y: from.top + from.height / 2 }
      : { x: w / 2, y: h / 2 }
    const out = []
    let doneMs = 0
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = startX + i * px
        const y = startY + j * py
        const dist = Math.hypot(x + px / 2 - origin.x, y + py / 2 - origin.y) / s
        const delay = Math.round(dist * RIPPLE_MS)
        doneMs = Math.max(doneMs, delay + CELL_MS)
        // Each cell's edges on whole pixels (the grid's cells are fractional): a cell
        // edge between two pixels is drawn soft on both sides, and two cells meeting
        // there leave a dark seam, a grid of hairlines over the image.
        const x0 = Math.round(x)
        const y0 = Math.round(y)
        out.push({
          key: `${i}-${j}`,
          style: {
            left: x0,
            top: y0,
            width: Math.round(x + px) - x0,
            height: Math.round(y + py) - y0,
            '--delay': `${delay}ms`,
          },
          inner: {
            backgroundImage: `url("${img.url}")`,
            backgroundSize: `${bw}px ${bh}px`,
            backgroundPosition: `${ox - x0}px ${oy - y0}px`,
          },
        })
      }
    }
    const whole = {
      backgroundImage: `url("${img.url}")`,
      backgroundSize: `${bw}px ${bh}px`,
      backgroundPosition: `${ox}px ${oy}px`,
    }
    return { cells: out, whole, doneMs }
  }, [img, box, from, fit])

  // Once every cell has finished its reveal, show the image in one piece instead, so
  // nothing can show between the cells (and the page has one layer, not hundreds).
  // With DEPTH on the cells stay, since the shading is per cell.
  const doneRef = useRef(0)
  doneRef.current = doneMs
  useEffect(() => {
    setSettled(false)
    if (!img || DEPTH.enabled) return undefined
    const t = setTimeout(() => setSettled(true), doneRef.current + 50)
    return () => clearTimeout(t)
  }, [img])

  return (
    <div
      className={`project_backdrop${closing ? ' is-closing' : ''}${DEPTH.enabled ? ' has-depth' : ''}${fit === 'contain' ? ' is-contain' : ''}`}
      style={{
        '--cell-ms': `${CELL_MS}ms`,
        '--depth': DEPTH.strength,
        '--depth-w': `${Math.round(DEPTH.width * 100)}%`,
        '--depth-hi': DEPTH.highlight,
      }}
      aria-hidden="true"
    >
      {media?.video ? (
        <video className="project_backdrop_video" autoPlay muted loop playsInline poster={media.video.poster}>
          {media.video.webm && <source src={media.video.webm} type="video/webm" />}
          {media.video.mp4 && <source src={media.video.mp4} type="video/mp4" />}
        </video>
      ) : settled && whole ? (
        <div className="project_whole" style={whole} />
      ) : (
        cells.map((c) => (
          <div key={c.key} className="project_cell" style={c.style}>
            <div className="project_cell_img" style={c.inner} />
            {DEPTH.enabled && <div className="project_cell_shade" />}
          </div>
        ))
      )}
    </div>
  )
}
