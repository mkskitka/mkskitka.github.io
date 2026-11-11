// Stacked layout: the menu panel on top, with the write-up and tiles under it, instead
// of beside it. Phones, and tablets held upright (every iPad in portrait is at most
// 1024px wide), where the panel beside the content left it too little width.
// Keep in step with the matching @media queries in styles/custom.css.
export const STACKED_QUERY = '(max-width: 767px), (orientation: portrait) and (max-width: 1100px)'
export const isStacked = () => window.matchMedia(STACKED_QUERY).matches
