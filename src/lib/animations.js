// Re-implementation of the Webflow "IX3" interactions this site used, in plain GSAP.
// The originals lived inside webflow.js and were:
//   1. Slide-in on scroll: headings/paragraphs reveal word by word, larger blocks slide up.
//   2. Card-link hover: slight fade + image zoom (done in CSS, see custom.css).
//   3. (The gallery marquee was replaced by components/Showcase.jsx.)
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// On phones the address bar showing/hiding resizes the viewport on every scroll;
// don't re-measure the pinned sections when that happens or they jump around.
ScrollTrigger.config({ ignoreMobileResize: true })

export { gsap, ScrollTrigger, SplitText }

const TEXT_SELECTOR =
  ':is(h1,h2,h3,.heading_primary,.heading_secondary,.subheading,.header p)' +
  ':not(:where(.card *,.card-link *,.rich-text *,li p))'

const BLOCK_SELECTOR =
  ':is(.grid-item-manual, .footer ul, .ix-link-wrapper:has(.card-link), .contact_link)'

/**
 * Reveal the contents of every `.section` / `.footer` inside `root` when it scrolls
 * into view (once). Returns a cleanup function; call it when the page unmounts.
 */
export function revealSections(root) {
  if (!root) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const ctx = gsap.context(() => {
    root.querySelectorAll('.section, .footer').forEach((section) => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 80%', once: true },
      })

      const textEls = Array.from(section.querySelectorAll(TEXT_SELECTOR))
      if (textEls.length) {
        const split = new SplitText(textEls, { type: 'words' })
        tl.from(
          split.words,
          {
            autoAlpha: 0,
            yPercent: 50,
            duration: 0.6,
            ease: 'power3.out',
            stagger: { amount: 0.6 },
            // Put the original text back once revealed so underlines / strike-throughs
            // render across whole links instead of only between words.
            onComplete: () => split.revert(),
          },
          0,
        )
      }

      const blocks = Array.from(section.querySelectorAll(BLOCK_SELECTOR))
      if (blocks.length) {
        tl.from(
          blocks,
          { autoAlpha: 0, y: 100, duration: 0.6, ease: 'power1.out', stagger: { each: 0.15 } },
          0.5,
        )
      }
    })
  }, root)

  return () => ctx.revert()
}

/**
 * Pin every `.section` inside `root` to the top of the viewport for a stretch of
 * scrolling before letting the page continue. `hold` is how long each section
 * stays put, as a fraction of the viewport height (0.75 = keep scrolling 75% of a
 * screen before the next section starts to arrive). Every section is pinned,
 * including the last one (the page holds still for that beat before it ends).
 * Sections marked `data-pin="self"` are skipped because they create their own
 * pin (see components/SystemsMenu.jsx).
 *
 * Works on phones too; reduced-motion users get a normal scroll.
 * Returns a cleanup function; call it when the page unmounts.
 */
export function pinSections(root, { hold = 0.75, selector = '.section' } = {}) {
  if (!root) return () => {}

  const mm = gsap.matchMedia()
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const sections = Array.from(root.querySelectorAll(selector))
    sections.forEach((section) => {
      if (section.dataset.pin === 'self') return
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * hold)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        // Pins add scroll distance below them, so measure them before anything
        // else (e.g. the reveal triggers above) works out where the sections sit.
        refreshPriority: 1,
      })
    })
  })

  return () => mm.revert()
}
