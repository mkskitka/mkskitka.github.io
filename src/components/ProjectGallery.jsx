import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * "Gallery" row inside a project's write-up: single-cell thumbnails of the project's
 * photos. Clicking one opens it full screen (lightbox); click, Escape, or the X
 * closes it, and the arrow keys / on-screen arrows step through the set.
 *
 * `images` is a list of { src, alt? }. Projects get it from `gallery` in
 * src/data/projects.js, falling back to their showcase images.
 */
export default function ProjectGallery({ images = [], label = 'Gallery' }) {
  const [index, setIndex] = useState(-1) // -1 = closed

  useEffect(() => {
    if (index < 0) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIndex(-1)
      } else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, images.length])

  if (!images.length) return null
  const current = images[index]

  return (
    <div className="gallery">
      <h3 className="gallery_label">{label}</h3>
      <div className="gallery_row">
        {images.map((img, i) => (
          <button key={img.src + i} type="button" className="gallery_thumb" onClick={() => setIndex(i)} aria-label={`Open photo ${i + 1}`}>
            <img src={img.src} alt={img.alt ?? ''} loading="lazy" />
          </button>
        ))}
      </div>
      {current &&
        createPortal(
          <div className="lightbox" onClick={() => setIndex(-1)} role="dialog" aria-modal="true">
            <img src={current.src} alt={current.alt ?? ''} className="lightbox_img" onClick={(e) => e.stopPropagation()} />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox_nav lightbox_nav--prev"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex((i) => (i - 1 + images.length) % images.length)
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
                    setIndex((i) => (i + 1) % images.length)
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
