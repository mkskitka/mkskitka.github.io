import { useEffect, useLayoutEffect, useMemo, useState } from 'react'

/**
 * A project's image filling the hero behind the grid lines, revealed square by
 * square: the page is cut into the backdrop's grid cells and each cell shows its
 * own portion of the image, animating in within its bounds (a soft zoom-and-fade)
 * in a ripple that spreads out from the clicked tile. Closing fades the whole thing.
 *
 * Images are revealed in cells. A hero *video* is shown as one element with a plain
 * fade (hundreds of video elements would be too heavy).
 */
const RIPPLE_MS = 38 // delay per cell of distance from the clicked tile
const CELL_MS = 650 // how long each cell's own animation takes
// Phones: each animated piece is this many backdrop cells square (still on the grid
// lines). One cell per piece is ~350 animated layers on a phone, which stutters;
// 2x2 is ~90. Desktop keeps one cell per piece.
const PHONE_PIECE_CELLS = 2
const isPhone = () => window.matchMedia('(max-width: 767px)').matches

export default function ProjectBackdrop({ project, from, onClosed, host }) {
  const [closing, setClosing] = useState(false)
  const [img, setImg] = useState(null) // { url, w, h }
  const [box, setBox] = useState({ w: 1, h: 1, s: 64 })

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
      const s = parseFloat(getComputedStyle(el).getPropertyValue('--grid-spacing')) || 64
      setBox({ w: el.clientWidth, h: el.clientHeight, s })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [host, project])

  // The cells, with their slice of the image and their ripple delay.
  const cells = useMemo(() => {
    if (!img) return []
    const { w, h, s } = box
    const scale = Math.max(w / img.w, h / img.h) // object-fit: cover
    const bw = img.w * scale
    const bh = img.h * scale
    const ox = (w - bw) / 2
    const oy = (h - bh) / 2
    const p = s * (isPhone() ? PHONE_PIECE_CELLS : 1) // piece size; pieces start on the line at -s/2 so their edges stay on lines
    const cols = Math.ceil((w + s / 2) / p)
    const rows = Math.ceil((h + s / 2) / p)
    const origin = from
      ? { x: from.left + from.width / 2, y: from.top + from.height / 2 }
      : { x: w / 2, y: h / 2 }
    const out = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -s / 2 + i * p
        const y = -s / 2 + j * p
        const dist = Math.hypot(x + p / 2 - origin.x, y + p / 2 - origin.y) / s
        out.push({
          key: `${i}-${j}`,
          style: {
            left: x,
            top: y,
            width: p,
            height: p,
            '--delay': `${Math.round(dist * RIPPLE_MS)}ms`,
          },
          inner: {
            backgroundImage: `url("${img.url}")`,
            backgroundSize: `${bw}px ${bh}px`,
            backgroundPosition: `${ox - x}px ${oy - y}px`,
          },
        })
      }
    }
    return out
  }, [img, box, from])

  return (
    <div
      className={`project_backdrop${closing ? ' is-closing' : ''}`}
      style={{ '--cell-ms': `${CELL_MS}ms` }}
      aria-hidden="true"
    >
      {media?.video ? (
        <video className="project_backdrop_video" autoPlay muted loop playsInline poster={media.video.poster}>
          {media.video.webm && <source src={media.video.webm} type="video/webm" />}
          {media.video.mp4 && <source src={media.video.mp4} type="video/mp4" />}
        </video>
      ) : (
        cells.map((c) => (
          <div key={c.key} className="project_cell" style={c.style}>
            <div className="project_cell_img" style={c.inner} />
          </div>
        ))
      )}
    </div>
  )
}
