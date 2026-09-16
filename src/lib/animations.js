// Re-implementation of the Webflow "IX3" interactions this site used, in plain GSAP.
// The originals lived inside webflow.js and were:
//   1. Slide-in on scroll: headings/paragraphs reveal word by word, larger blocks slide up.
//   2. Card-link hover: slight fade + image zoom (done in CSS, see custom.css).
//   3. (The gallery marquee was replaced by components/Showcase.jsx.)
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

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
