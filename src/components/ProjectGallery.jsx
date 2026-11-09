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
/**
 * A video in the gallery row. It shows its poster frame and downloads nothing until it
 * is on screen; then it plays, muted and looping, and pauses again once it is scrolled
 * out of view. (Before this, every video in the row started downloading in full the
 * moment the project opened, poster or not.)
 */
function RowVideo({ src, poster, label }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const play = () => el.play()?.catch?.(() => {})
    if (typeof IntersectionObserver === 'undefined') {
      play()
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play()
        else el.pause()
      },
      { rootMargin: '100px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [src])
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={label} />
}

export default function ProjectGallery({ images = [], label = 'Gallery' }) {
  const [index, setIndex] = useState(-1) // -1 = closed
  const [drag, setDrag] = useState(0) // px the open photo is pulled sideways by a swipe
  const touch = useRef(null)
  const row = useRef(null)

  // The row is one line that scrolls sideways when it overflows (custom.css). A mouse
  // wheel only goes up and down, so over the row that movement scrolls it sideways
  // (trackpads and touch scroll it sideways on their own). Set natively: React's own
  // wheel events are passive, so they could not cancel the page's handling.
  useEffect(() => {
    const el = row.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [images.length])

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
      <div ref={row} className="gallery_row">
        {images.map((img, i) => (
          <button key={img.src + i} type="button" className="gallery_thumb" onClick={() => setIndex(i)} aria-label={`Open photo ${i + 1}`}>
            {img.video ? (
              <RowVideo src={img.src} poster={img.poster} label={img.alt || undefined} />
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
              <video key={current.src} src={current.src} className="lightbox_img" style={pull} autoPlay muted loop playsInline controls onClick={(e) => e.stopPropagation()} />
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
