// Sort orders for the Visuals tiles on the home page (components/VisualsSort.jsx is
// the dropdown; the choice is kept in the address as ?sort=<id>, so a sorted view can
// be sent as a link). Written per kind of tiles, so the Systems tiles can get orders
// too: add a `systems` list here and a control in pages/Home.jsx (projects carry a
// year in `date`, from resume/resume.json, and a `title`).
//
// Visuals carry the Instagram post's `timestamp`, and a `hue` (0..359, from
// scripts/image-color.mjs; null for a grey image) for the colour-wheel order, which
// runs red, orange, yellow, green, cyan, blue, violet, back to red, with the grey
// images after. Items with no date or no hue go last.
// Sorting is stable, so ties keep the hand-written order from the data file.
export const SORTS = {
  visuals: [
    { id: 'newest', label: 'Newest' }, // Instagram order
    { id: 'oldest', label: 'Oldest' },
    { id: 'color', label: 'Color' }, // around the colour wheel
    { id: 'shuffle', label: 'Shuffle' }, // a new order each time it is clicked
  ],
}
export const DEFAULT_SORT = { visuals: 'newest' }
export const isSort = (kind, id) => !!SORTS[kind]?.some((s) => s.id === id)

// When an item was made, in ms, or null when it says nothing usable.
const when = (item) => {
  const raw = item.timestamp ?? item.date
  const t = raw == null ? NaN : Date.parse(String(raw))
  return Number.isNaN(t) ? null : t
}
// The title with any leading punctuation dropped ("'24 VENICE BIENNALE" sorts under 2).
const name = (item) => String(item.title ?? '').replace(/^[^\p{L}\p{N}]+/u, '')

// Compare by a key; dir 1 = ascending, -1 = descending; missing keys last either way.
const by = (key, dir) => (a, b) => {
  const ka = key(a)
  const kb = key(b)
  if (ka == null && kb == null) return 0
  if (ka == null) return 1
  if (kb == null) return -1
  return ka < kb ? -dir : ka > kb ? dir : 0
}

export function sortItems(items, id, seed = 0) {
  const out = items.slice()
  switch (id) {
    case 'newest':
      return out.sort(by(when, -1))
    case 'oldest':
      return out.sort(by(when, 1))
    case 'color':
      return out.sort(by((item) => (typeof item.hue === 'number' ? item.hue : null), 1))
    case 'az':
      return out.sort((a, b) => name(a).localeCompare(name(b), undefined, { sensitivity: 'base', numeric: true }))
    case 'shuffle': {
      // Fisher-Yates with a seeded generator, so one seed always gives the same order.
      let s = Math.floor(seed * 2 ** 31) || 1
      const rnd = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        return s / 2 ** 32
      }
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    }
    default:
      return out
  }
}
