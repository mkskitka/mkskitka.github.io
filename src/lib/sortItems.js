// Two separate things the tiles on the home page can be asked for, each with its own
// dropdown in the top right corner (components/VisualsSort.jsx):
//   Sort: the ORDER the whole set is put in (SORTS below): newest first, by colour...
//   Show: WHICH of the set are shown (SUBSETS below): all of them, or only those
//         carrying a tag (AI, Web...).
// Both are kept in the address, ?show=<id>&sort=<id> (plus &rev=1 when the order is
// flipped), so a view can be sent as a link. Written per kind of tiles ('visuals',
// 'systems').
//
// Visuals carry the Instagram post's `timestamp` and the numbers measured from the
// image by scripts/image-metrics.mjs (hue, light, vivid, busy, glitch). Every order
// but Shuffle is an axis with two ends: `label` reads the default way, `flipped` the
// other way round (picking the active order again flips it), and `ends` is what
// lies to the left and to the right of the tiles on screen, written on the scroll
// arrows. Items missing the number an order needs go last either way. Sorting is
// stable, so ties keep the Instagram order.
//
// Offered in the dropdown: the list below. Measured and ready but left out for now:
// busy (Calm → Busy), vivid (Muted → Vivid), glitch (Organic → Glitch); add a line
// here to offer one.
export const SORTS = {
  visuals: [
    { id: 'color', label: 'Color wheel', flipped: 'Color wheel, reversed', ends: ['warmer', 'cooler'] }, // the default: red, orange, yellow, green, cyan, blue, violet; greys after
    { id: 'newest', label: 'Newest', flipped: 'Oldest', ends: ['newer', 'older'] },
    { id: 'light', label: 'Dark → Light', flipped: 'Light → Dark', ends: ['darker', 'lighter'] },
    { id: 'shuffle', label: 'Shuffle' }, // a new order each time it is picked
  ],
  // Systems (the project tiles): by date. Picking it again flips it.
  systems: [{ id: 'newest', label: 'Newest', flipped: 'Oldest', ends: ['newer', 'older'] }],
}
// Subsets (the Show dropdown): 'all', only the items carrying `tag`, or every item but
// those carrying `without` (an item's `tags`, a list of strings: for projects, `tags`
// in src/data/projects.js). Featured works the second way round, so a project is
// featured unless it is tagged 'unfeatured', and a newly added one shows up without
// being tagged. A subset no item's tags bear on is not offered, and with nothing but
// All to offer the dropdown is not shown at all (Visuals, until the pieces carry
// tags). To add one: a line here, and the tag on the items. Which subset the tiles
// open in is in DEFAULT_SORT below.
export const SUBSETS = {
  systems: [
    { id: 'all', label: 'All' },
    { id: 'featured', label: 'Featured', without: 'unfeatured' },
    { id: 'ai', label: 'AI', tag: 'ai' },
    { id: 'web', label: 'Web', tag: 'web' },
    { id: 'installation', label: 'Installation', tag: 'installation' },
  ],
  visuals: [{ id: 'all', label: 'All' }],
}
const tagged = (tag) => (item) => Array.isArray(item.tags) && item.tags.includes(tag)
// The subsets on offer for these items: All, and each one whose tag at least one of
// them carries.
export const subsetsOf = (kind, items) => (SUBSETS[kind] ?? []).filter((s) => (!s.tag && !s.without) || items.some(tagged(s.tag ?? s.without)))
// The items of a subset, in the order given (all of them for 'all' or an unknown id).
export const subsetItems = (items, kind, id) => {
  const subset = SUBSETS[kind]?.find((s) => s.id === id)
  if (subset?.tag) return items.filter(tagged(subset.tag))
  if (subset?.without) return items.filter((item) => !tagged(subset.without)(item))
  return items
}
// What lies left and right of the tiles under an order, as written on the scroll
// arrows: ['darker', 'lighter'], or null when the order has no ends (Shuffle).
export const sortEnds = (kind, id, rev = false) => {
  const ends = SORTS[kind]?.find((s) => s.id === id)?.ends
  return ends ? (rev ? [ends[1], ends[0]] : ends) : null
}
// The view the tiles open in: the order per kind, whether it is flipped, and the
// subset per kind (`show`).
export const DEFAULT_SORT = { visuals: 'color', systems: 'newest', rev: false, show: { visuals: 'all', systems: 'featured' } }
export const isSort = (kind, id) => !!SORTS[kind]?.some((s) => s.id === id)

// The number each order sorts by (null when the item does not have it), and which
// way is the default: 1 ascending, -1 descending.
const num = (k) => (item) => (typeof item[k] === 'number' ? item[k] : null)
const when = (item) => {
  const raw = item.timestamp ?? item.date
  const t = raw == null ? NaN : Date.parse(String(raw))
  return Number.isNaN(t) ? null : t
}
const KEYS = {
  newest: [when, -1],
  color: [num('hue'), 1],
  light: [num('light'), 1],
  busy: [num('busy'), 1],
  vivid: [num('vivid'), 1],
  glitch: [num('glitch'), 1],
}

const by = (key, dir) => (a, b) => {
  const ka = key(a)
  const kb = key(b)
  return ka < kb ? -dir : ka > kb ? dir : 0
}

export function sortItems(items, id, { seed = 0, rev = false } = {}) {
  if (id === 'shuffle') {
    // Fisher-Yates with a seeded generator, so one seed always gives the same order.
    const out = items.slice()
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
  const entry = KEYS[id]
  if (!entry) return items.slice()
  const [key, dir] = entry
  const keyed = items.filter((item) => key(item) != null).sort(by(key, rev ? -dir : dir))
  const rest = items.filter((item) => key(item) == null)
  return keyed.concat(rest)
}
