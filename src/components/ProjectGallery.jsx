import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * "Gallery" row inside a project's write-up: single-cell thumbnails of the project's
 * photos, gifs and videos (videos loop muted in the row and play with sound and
 * controls when opened). Clicking one opens it full screen (lightbox); click, Escape, or the X
 * closes it, and the arrow keys / on-screen arrows step through the set. On a touch
 * screen, swiping left or right does the same (the photo follows the finger).
 *
 * `images` is a list of { src, alt?, video? }. Projects get it from `gallery` in
 * src/data/projects.js, or from the files in their assets folder; with neither, no row is shown.
 */
export default function ProjectGallery({ images = [], label = 'Gallery' }) {
  const [index, setIndex] = useState(-1) // -1 = closed
  const [drag, setDrag] = useState(0) // px the open photo is pulled sideways by a swipe
  const touch = useRef(null)

  const step = (dir) => setIndex((i) => (i + dir + images.length) % images.length)

  // Swipe: once the finger has clearly gone sideways the photo follows it; letting go
  // past SWIPE px moves on to the next / previous one, otherwise it settles back.
  const SWIPE = 50
  const onTouchStart = (e) => {
    if (images.length < 2 || e.touches.length !== 1) return (touch.current = null)
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, side: null }
  }
  const onTouchMove = (e) => {
    const t = touch.current
    if (!t) return
    const dx = e.touches[0].clientX - t.x
    const dy = e.touches[0].clientY - t.y
    if (t.side === null && Math.hypot(dx, dy) > 8) t.side = Math.abs(dx) > Math.abs(dy)
    if (t.side) setDrag(dx)
  }
  const onTouchEnd = () => {
    const t = touch.current
    touch.current = null
    if (t?.side && Math.abs(drag) > SWIPE) step(drag < 0 ? 1 : -1)
    setDrag(0)
  }

  useEffect(() => {
    if (index < 0) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIndex(-1)
      } else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, images.length])

  if (!images.length) return null
  const current = images[index]
  const pull = drag ? { transform: `translateX(${drag}px)`, opacity: 1 - Math.min(0.6, Math.abs(drag) / 500), transition: 'none' } : undefined

  return (
    <div className="gallery">
      <h3 className="gallery_label">{label}</h3>
      <div className="gallery_row">
        {images.map((img, i) => (
          <button key={img.src + i} type="button" className="gallery_thumb" onClick={() => setIndex(i)} aria-label={`Open photo ${i + 1}`}>
            {img.video ? (
              <video src={img.src} autoPlay muted loop playsInline preload="metadata" aria-label={img.alt || undefined} />
            ) : (
              <img src={img.src} alt={img.alt ?? ''} loading="lazy" />
            )}
          </button>
        ))}
      </div>
      {current &&
        createPortal(
          <div
            className="lightbox"
            onClick={() => setIndex(-1)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            role="dialog"
            aria-modal="true"
          >
            {current.video ? (
              <video key={current.src} src={current.src} className="lightbox_img" style={pull} autoPlay loop playsInline controls onClick={(e) => e.stopPropagation()} />
            ) : (
              <img key={current.src} src={current.src} alt={current.alt ?? ''} className="lightbox_img" style={pull} draggable={false} onClick={(e) => e.stopPropagation()} />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox_nav lightbox_nav--prev"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation()
                    step(-1)
                  }}
                >
                  &lt;-
                </button>
                <button
                  type="button"
                  className="lightbox_nav lightbox_nav--next"
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation()
                    step(1)
                  }}
                >
                  -&gt;
                </button>
              </>
            )}
            <button type="button" className="lightbox_close" aria-label="Close" onClick={() => setIndex(-1)}>
              x
            </button>
            <div className="lightbox_count">
              {index + 1} / {images.length}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
