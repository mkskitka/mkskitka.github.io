import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sha256 } from '../lib/sha256.js'

/**
 * Password prompt for a locked project (one with `lock` set in src/data/projects.js).
 * `lock` is the SHA-256 of the password, so the password itself is not in the code;
 * make one with  node scripts/lock-password.mjs "the password".
 *
 * A correct password is remembered until the browser tab is closed. This keeps
 * casual visitors out; it is not strong protection, since the project's files are
 * still part of the published site.
 */
const KEY = (slug) => `unlocked:${slug}`

export function isUnlocked(project) {
  if (!project?.lock) return true
  try {
    return sessionStorage.getItem(KEY(project.slug)) === project.lock
  } catch {
    return false
  }
}

export default function ProjectLock({ project, onUnlock, onCancel }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false) // last try failed: the hint says so until the next correct one
  const [shake, setShake] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    setValue('')
    setWrong(false)
    setShake(false)
    if (project) input.current?.focus()
  }, [project])

  useEffect(() => {
    if (!project) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [project, onCancel])

  if (!project) return null

  const submit = (e) => {
    e.preventDefault()
    if (sha256(value) !== project.lock) {
      setWrong(true)
      setShake(true)
      setValue('')
      input.current?.focus()
      return
    }
    try {
      sessionStorage.setItem(KEY(project.slug), project.lock)
    } catch {
      // private window etc: just ask again next time
    }
    onUnlock?.()
  }

  return createPortal(
    <div className="project_lock" onClick={onCancel} role="dialog" aria-modal="true" aria-label={`Password for ${project.title}`}>
      <form className={`project_lock_panel${shake ? ' is-shaking' : ''}${wrong ? ' is-wrong' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={submit} onAnimationEnd={() => setShake(false)}>
        <svg className="project_lock_icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
        </svg>
        <p className="project_lock_text">{project.title} is private</p>
        <input
          ref={input}
          type="password"
          className="project_lock_input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete="off"
        />
        <p className="project_lock_hint" role="alert">
          {wrong ? 'Not quite, try again' : 'Press enter to open'}
        </p>
        <button type="submit" className="project_lock_submit" tabIndex={-1} aria-hidden="true" />
      </form>
    </div>,
    document.body,
  )
}
