import { useEffect, useRef } from 'react'

/**
 * Autoplaying, muted, looping background video (Webflow's "Background Video" element).
 * `video` is { mp4, webm, poster }. `className` is applied to the wrapper.
 */
export default function BackgroundVideo({ video, className = '', children }) {
  const ref = useRef(null)

  // React doesn't reliably reflect the `muted` attribute, and browsers refuse to
  // autoplay un-muted video, so set it imperatively.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }, [])

  return (
    <div className={`${className} w-background-video w-background-video-atom`}>
      <video
        ref={ref}
        autoPlay
        loop
        muted
        playsInline
        poster={video.poster}
        style={{ backgroundImage: `url("${video.poster}")` }}
      >
        <source src={video.mp4} type="video/mp4" />
        <source src={video.webm} type="video/webm" />
      </video>
      {children}
    </div>
  )
}
