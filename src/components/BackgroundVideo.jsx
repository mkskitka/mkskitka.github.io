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
    const play = () => {
      const p = el.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    play()

    // This video should never stop: it loops and has no controls. Mobile Safari
    // still pauses it when the section gets pinned (ScrollTrigger moves the section
    // into a spacer element) or when the tab goes to the background, so restart it.
    const resume = () => {
      if (el.isConnected && el.paused && !el.ended && !document.hidden) play()
    }
    el.addEventListener('pause', resume)
    document.addEventListener('visibilitychange', resume)
    // If autoplay was refused (e.g. iOS Low Power Mode), the first touch allows it.
    window.addEventListener('touchend', resume, { passive: true })
    return () => {
      el.removeEventListener('pause', resume)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('touchend', resume)
    }
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
