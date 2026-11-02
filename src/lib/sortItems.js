// Sort orders for the Visuals tiles on the home page (components/VisualsSort.jsx is
// the dropdown; the choice is kept in the address as ?sort=<id>, plus &rev=1 when the
// order is flipped, so a sorted view can be sent as a link). Written per kind of
// tiles, so the Systems tiles can get orders too: add a `systems` list here and a
// control in pages/Home.jsx.
//
// Visuals carry the Instagram post's `timestamp` and the numbers measured from the
// image by scripts/image-metrics.mjs (hue, light, vivid, busy, glitch). Every order
// but Shuffle is an axis with two ends: `label` reads the default way, `flipped` the
// other way round (picking the active order again flips it). Items missing the
// number an order needs go last either way. Sorting is stable, so ties keep the
// Instagram order.
export const SORTS = {
  visuals: [
    { id: 'newest', label: 'Newest', flipped: 'Oldest' },
    { id: 'color', label: 'Color wheel', flipped: 'Color wheel, reversed' }, // red, orange, yellow, green, cyan, blue, violet; greys after
    { id: 'light', label: 'Dark → Light', flipped: 'Light → Dark' },
    { id: 'busy', label: 'Calm → Busy', flipped: 'Busy → Calm' },
    { id: 'vivid', label: 'Muted → Vivid', flipped: 'Vivid → Muted' },
    { id: 'glitch', label: 'Organic → Glitch', flipped: 'Glitch → Organic' },
    { id: 'shuffle', label: 'Shuffle' }, // a new order each time it is picked
  ],
}
export const DEFAULT_SORT = { visuals: 'newest', rev: false }
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
