import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* ============================================================================
   GRID + INK BACKDROP (three.js, GPU) — after the "gem vertahorizlines" piece.

   LINES: thin gradient lines on a near-black ground. Each set has:
     start          where the lines begin, as a fraction of the page
                    (horizontal: 0 = left edge; vertical: 0 = top edge)
     initialLength  how long they are on page load (fraction of the page)
     finalLength    how long they grow to; 1 = all the way to the far edge
     growth         'time'     grow on their own from page load
                    'onScroll' start growing at the first scroll, then take `seconds`
                    'scroll'   follow the hero scroll position
                    'none'     stay at initialLength
     seconds        time / onScroll modes: how long the growth takes
     finishWithLock time mode only: if still growing when the scroll lock starts, speed
                    up so the lines are complete when the lock ends
     scrollRange    scroll mode: how much of the hero scroll completes the growth
     ease           'linear' | 'out' | 'inOut'
     colors         gradient along the line, start end -> far end

   SCROLL INPUT (scroll.mode): the page itself does not move; there are no scroll
   bars. 'virtual' turns wheel, trackpad, touch-drag and arrow/space keys into a
   0..1 progress over `scroll.range` screens' worth of input, and the 'scroll'-mode
   lines (and the ink trigger) follow that. 'page' uses the real scroll position
   within a pinned hero instead, for when the site has more sections again.

   SCROLL LOCK (scrollLock, off by default): alternatively hold the page still for
   `seconds` at the first scroll while the lines animate on their own.

   PAINTING (ink.paint): click anywhere on the backdrop to add a drop; click and hold
   to keep pouring ink where the pointer is, and drag to paint with it. On touch
   screens a tap adds a drop (dragging is left to scrolling).

   INK: a liquid simulation. Your first scroll starts a sequence of drops at random
   spots (new every page load); they land one after another and soak outward through
   fibrous "paper" like ink on a paper towel: fast at first, then slowing, with a
   ragged, denser front. Drops that meet merge. The grid colours the ink: at any
   point it is the average of the horizontal-line colour at that x and the
   vertical-line colour at that y.

   LINES AS DAMS (ink.dams): every grid line is a barrier. Ink soaks naturally
   inside whatever region it is in — a closed square, an open row or column that
   it travels along, or the open page — and when it meets a line it has to build
   pressure above `lineThreshold` before it spills across. Once over, it pours into
   the next region (losing `lineLoss`) and soaks there until it meets the next line.
   So the stain grows cell by cell, but every cell fills like liquid.
   ============================================================================ */
/* Grid colour palettes. `PALETTE` picks the active one; the rest are kept so you can
   switch back any time (change the name, save, done). Each has the horizontal line
   gradient (left -> right), the vertical one (top -> bottom), and the ground colour. */
const PALETTES = {
  'mk-original': {
    horizontal: { from: [235, 70, 55], to: [45, 215, 205] }, // red -> teal
    vertical: { from: [50, 90, 235], to: [240, 75, 130] }, // blue -> pink
    background: [12, 12, 14],
  },
  cyan: {
    horizontal: { from: [0, 200, 230], to: [220, 245, 250] }, // cyan -> white
    vertical: { from: [0, 170, 220], to: [30, 60, 160] }, // cyan -> deep blue
    background: [8, 10, 14],
  },
  signal: {
    horizontal: { from: [60, 110, 255], to: [150, 90, 255] }, // electric blue -> violet
    vertical: { from: [120, 80, 240], to: [240, 70, 170] }, // violet -> magenta
    background: [9, 9, 16],
  },
  neon: {
    horizontal: { from: [255, 60, 150], to: [255, 150, 60] }, // hot pink -> orange
    vertical: { from: [0, 220, 255], to: [60, 90, 255] }, // cyan -> blue
    background: [8, 8, 14],
  },
}
const PALETTE = 'mk-original' // <- active palette: 'mk-original' | 'cyan' | 'signal' | 'neon'
const ACTIVE = PALETTES[PALETTE] ?? PALETTES['mk-original']

// GLOW STYLES: the three looks a moving light on the lines can have. Each is named after
// the animation it was first made for; any animation can use any of them (GLOW_STYLE).
//   shape  'tip'  = lit at a leading end, with the light trailing off behind it
//          'band' = a soft band of light, fading equally in front and behind
//   light  'point' = a round glow sitting on the leading end
//          'line'  = soft light hugging the lines along the lit stretch
//   length      how far the light reaches along the line, as a fraction of the page
//   brightness  extra brightness on the lit lines (0 none, 1 double)
//   thicken     extra line thickness where lit, in px
//   halo        size of the soft light, in px
//   haloStrength how bright that soft light is (0 none, 1 strong)
const GLOW_STYLES = {
  contact: { shape: 'tip', light: 'point', length: 0.18, brightness: 1, thicken: 0.6, halo: 7, haloStrength: 0.7 },
  load: { shape: 'tip', light: 'line', length: 0.12, brightness: 0.9, thicken: 0.6, halo: 5, haloStrength: 0.5 },
  systems: { shape: 'band', light: 'line', length: 0.14, brightness: 0.45, thicken: 0.5, halo: 3.5, haloStrength: 0.25 },
}
// Which style each animation uses: 'contact', 'load' or 'systems'.
const GLOW_STYLE = {
  load: 'contact', // the lines growing across when the page loads
  systems: 'contact', // the light that crosses the page when SYSTEMS opens
  contact: 'contact', // the lines that come down when CONTACT opens
}
const glowLook = (which) => GLOW_STYLES[GLOW_STYLE[which]] ?? GLOW_STYLES.contact

const SETTINGS = {
  background: ACTIVE.background,
  spacing: 0.06, // gap between lines, as a fraction of the shorter page side (only when rowsFromText is 0)
  minSpacing: 22, // px
  maxSpacing: 80, // px
  // Fit the grid to the page: nudge the cell size so a whole number of cells fits the
  // width and the height exactly, with lines landing on all four edges and no part
  // cells anywhere. Cells end up very slightly non-square (a few percent).
  // false = the old grid: one square cell size, half cells at the edges.
  fitToPage: true,

  rowsFromText: 1.2, // row height = hero menu text size x this, so one line of text fits a row, on every screen size
  //                    (0 = use `spacing`). Phones get a smaller text size (--hero-menu-size in custom.css), so a larger
  //                    grid than `spacing` would give, with the menu text and its glass panel on the lines.
  weight: 1.1, // line thickness in px
  scrollSmoothing: 0.1, // how smoothly the lines follow the scroll: 0.05 very floaty, 0.1 smooth, 1 instant (jumps with each wheel click)

  horizontal: {
    colors: ACTIVE.horizontal,
    start: 0,
    initialLength: 0,
    finalLength: 1,
    growth: 'time',
    seconds: 5, // how long the lines take to grow across on page load
    finishWithLock: true,
    scrollRange: 1,
    // How the lines' speed changes as they grow across on page load (over `seconds`):
    //   'linear'    steady speed
    //   'out'       starts fast, eases off toward the end
    //   'outStrong' starts faster and slows down much more near the end
    //   'outExpo'   almost all the way at once, then a long slow finish
    //   'inOut'     slow start, fast middle, slow end
    ease: 'outStrong',
  },

  vertical: {
    colors: ACTIVE.vertical,
    start: 0,
    initialLength: 0, // full height straight away: no scroll animation
    finalLength: 0,
    growth: 'none', // 'scroll' puts the scroll-driven grow-down animation back
    seconds: 3,
    scrollRange: 0.65,
    ease: 'linear',
  },

  // Depth: make the grid read as bevelled tiles. Each cell's face is lifted a touch
  // above the ground and its edges fall away toward the lines, with light from the
  // top-left (top/left edges brighter, bottom/right edges darker). Only cells that
  // are bounded by lines on both axes get it, so tiles appear as the grid completes.
  depth: {
    enabled: true,
    face: 0.15, // how much lighter a tile's face is than the ground (0..0.1)
    bevel: 0.1, // strength of the edge shading (0 flat, 1 strong)
    width: 0.1, // how far the bevel reaches into the cell, as a fraction of the cell
    tint: 1, // how much the tile face picks up the grid colour at that spot (0 grey, 1 full)
    openBars: true, // also shade open rows and columns (bounded on one axis only) as long
    //                 bars, so the relief is there while the grid is still growing in.
    //                 false = only fully closed cells get depth.
  },

  scroll: {
    mode: 'virtual', // 'virtual': wheel/touch/keys drive the animation, page stays put | 'page': real scrolling
    range: 1.5, // virtual: screens' worth of wheel/touch input for one half-cycle (lines growing down)
    keyStep: 0.08, // virtual: how far one arrow-key press moves (fraction of the range)
    loop: false, // virtual: true = keep going forever. The lines follow the scroll: down over one `range`
    //             of scrolling, back up over the next, and again, so scrolling never ends.
    //             Scrolling up runs it backwards. false = stop at the end like a normal page.
    dwell: 0.6, // loop: pause at each end, in ranges of scrolling (0.6 = 60% of `range` of scrolling
    //             with the lines held fully down, and again held fully up, before they turn around)
    finishFirst: true, // loop: once the lines start moving down (or up) they must reach the end before
    //             the direction can change; scrolling the other way mid-travel is ignored
    // Optional alternative: each gesture commits to one complete sweep instead of following
    // the scroll position (set enabled: true).
    sweep: {
      enabled: false, // true = one full down/up sweep per scroll gesture, ignoring input mid-sweep
      seconds: 2.2, // how long one full sweep takes
      ease: 'inOut', // 'linear' | 'out' | 'inOut'
      threshold: 30, // px of wheel/touch input needed to trigger the next sweep
    },
  },

  scrollLock: {
    enabled: false, // optional: hold the page still for `seconds` at the first scroll (off: scrolling drives everything)
    seconds: 3,
    scrollStart: 0.02, // how far into the hero (0..1) the first scroll has to go to count as "the first scroll"
  },

  ink: {
    enabled: true,
    trigger: 'none', // 'scroll': the first scroll starts the drops, then they keep landing on their own
    //                     'time': start as soon as the page loads | 'none': never
    drops: 7, // how many drops land in total (max 16)
    scrollStart: 0.02, // scroll mode: how far you have to scroll (0..1 of the hero) before the drops start
    interval: 1.2, // seconds between drops once they have started
    randomPositions: true, // true: new drop positions every page load | false: same positions each time (uses seed)
    area: 'page', // 'page': drops land anywhere | 'grid': only inside the part of the page the grid has reached so far
    dropRadius: 0.012, // size of the puddle a drop makes on landing, as a fraction of the page width
    pour: 2, // seconds a drop keeps feeding ink after it lands
    spread: 1.6, // how far ink soaks before its pressure runs out (1 ≈ a quarter of the page width); lower = more fade across a stain
    speed: 3, // how fast it soaks (1 slow and viscous, 4 quick)
    fibers: 1, // paper texture: 0 smooth blot, 1 fibrous edges, 2 very ragged
    fiberScale: 40, // size of the fibre pattern (higher = finer)
    rim: 0.35, // brighter, more saturated ring at the wet front (0 = none)

    // Gaseous look: the ink reads as smoke / cloud rather than a solid stain.
    density: .5, // how opaque the thickest part gets (0..1)
    softness: 0.7, // width of the soft gradient from clear to full (0.2 crisp stain, 0.9 very hazy)
    cloudiness: 0.75, // how much the interior varies in density, like cloud (0 flat, 1 very patchy)
    wisps: 0.7, // how much fine noise eats thin ink into tendrils (0 smooth, 1 ragged smoke)
    drift: 0.5, // speed of the slow smoke-like motion (0 still)
    shimmer: 1, // size of that motion (0 none)
    diffuse: 0.1, // simulation smoothing per step: softens fronts, lets ink slowly thin out (0 off, 0.15 very soft)
    seed: 7, // paper fibre pattern (and drop positions when randomPositions is false)

    paint: {
      enabled: true, // click / hold / drag on the backdrop to add ink
      radius: 0.012, // size of the pointer's puddle, as a fraction of the page width
      strength: .8, // how hard it pours while held (0.5 gentle, 1 full pressure)
    },

    dams: true, // grid lines hold the ink back until it builds up pressure (see header)
    lineThreshold: .8, // pressure needed at a line before ink spills across (0.1 leaky, 0.6 very tight)
    lineLoss: 0.06, // pressure lost crossing a line (higher = fewer cells reached)
  },

  // SYSTEMS: every time the Systems page opens, a band of light travels along the grid
  // lines from the left edge to the right (brighter, a touch thicker, with a soft halo),
  // leaving the lines as they were behind it.
  // What the light itself looks like is set by GLOW_STYLE.systems, above SETTINGS.
  glow: {
    seconds: 1.8, // how long the light takes to cross the page
  },

  // TIP GLOW: while the horizontal lines are growing across the page, their leading
  // end is lit like the Systems band (brighter, a touch thicker, with a soft halo that
  // rounds off the tip) and the light trails off behind it. It fades out as they arrive.
  // What the light itself looks like is set by GLOW_STYLE.load, above SETTINGS.
  tipGlow: {
    enabled: true,
    fade: 0.08, // how quickly it fades in and out as the lines start and stop (0.02 slow, 0.3 quick)
  },

  // VISUALS BOUNCE: for a few seconds after Visuals is selected, the horizontal lines bounce like an
  // audio visualiser: each line is a waveform that ripples along its length, some lines
  // louder than others (like frequency bands), and they all kick together on a beat.
  // There is no real audio; the "signal" is generated.
  bounce: {
    enabled: true,
    seconds: .4, // how long it lasts after Visuals is selected, before easing back to straight lines
    amplitude: 2.2, // how far the lines move, in rows: typical swings are about half this, the loudest peaks about 1.5x
    reach: 2.5, // the furthest a line can ever travel, in rows; peaks round off as they near it (max 2.5).
    //             Lines now overlap and cross their neighbours, and the tile bevels flatten while it plays
    waves: 6, // how many ripples fit across the page (higher = busier waveform)
    speed: 1.6, // how fast the waveform changes
    bpm: 60, // tempo of the beat the lines kick on
    kick: 0.6, // how much of the movement follows the beat (0 steady ripple, 1 only on the beat)
    fade: 0.05, // how quickly it eases in and out (0.02 slow, 0.3 quick)
  },

  // CONTACT TRACES: while the Contact page is open, a set of lines comes down from the
  // top edge on evenly spaced grid columns at the left of the page. Each one turns
  // right at a horizontal line and carries on along it to the right edge, drawing a
  // right angle. The leftmost goes furthest down and each one after it turns a step
  // higher, so the right angles sit one inside the next and never cross. The leading
  // end glows as it travels. They fade away when Contact closes.
  trace: {
    enabled: true,
    count: 8, // how many lines come down (max 16; fewer if the page runs out of rows or columns)
    firstColumn: 1, // grid column of the leftmost line (0 = the left edge of the page)
    columnStep: 1, // grid columns between one line and the next
    lowestRow: 1, // how many rows up from the bottom the leftmost line turns
    rowStep: 1, // grid rows between one line's turn and the next (each turns this much higher)
    speed: 0.7, // how fast they travel, in page heights per second
    stagger: 0.07, // seconds between one line setting off and the next, left to right (0 = all together)
    colors: PALETTES['mk-original'].vertical, // gradient down the page, top -> bottom: the original palette's
    //                       vertical colours (blue -> pink), whichever grid palette is active
    // What the light at the leading end looks like is set by GLOW_STYLE.contact, above SETTINGS.
    fade: 0.06, // how quickly the lines fade in and out with the page (0.02 slow, 0.3 quick)
  },

  // VISUALS: every time VISUALS is clicked, a pour of smoke lands somewhere on the
  // page. It comes out as a few puffs that wander off from the spot in different
  // directions, each with ragged, shifting edges, so it billows out in uneven lobes
  // instead of a round blot. Unlike the drops it is real smoke: swirling air carries
  // it, it rises and spreads, and it thins out until it is gone. It is drawn with the
  // same smoky look as the ink.
  pour: {
    enabled: false, // true puts the Visuals pour back
    puffs: 8, // how many puffs pour out together (max 8)
    seconds: 4, // how long they keep pouring (each gets 60-100% of this)
    radius: 0.01, // size of a puff when it starts, as a fraction of the page width
    grow: 3, // how much bigger a puff gets by the end of its run (1 = same size)
    speed: 0.05, // how fast a puff wanders away from the spot, in page widths per second
    curl: 4, // how much the puffs' paths bend (radians per second)
    fan: 3.5, // angle the puffs spread over around a random direction (radians; 6.3 = all round)
    rise: 0, // how much they drift upward overall, like rising smoke (0 none)
    ragged: .9, // how irregular and churning a puff's edge is (0 round, 1 very ragged)
    strength: 1, // how thick the smoke is where it pours out (0.5 faint, 1 full)
    // After it pours: how the smoke moves and fades.
    fade: 200, // how long it lasts, in seconds:  thins out to about a third over this long (very large = never fades)
    flow: 0.1, // speed of the swirling air carrying it, in page heights per second (0 still)
    swirl: 2, // size of the swirls (higher = smaller, busier curls)
    lift: 0.04, // how fast it rises, in page heights per second
    blur: 0.01, // how fast it spreads out and softens (0 none, 0.05 quickly); spreading also makes it fainter,
    //              since the same smoke covers more area, so keep this low for long-lasting smoke
    area: [0.35, 0.92, 0.15, 0.85], // where it can land: x from, x to (0 left), y from, y to (0 bottom); kept right of the menu
  },

  // Phones: screens narrower than `maxWidth` use these ink values instead of the ones
  // above (same meanings). A phone page is small and tall, so the desktop amounts read
  // as a few specks; more drops that soak further fill it like the desktop does.
  phone: {
    maxWidth: 767,
    pixelRatio: 1.5, // canvas density cap on phones (desktop: 2). Phone screens are 2-3x; the noise shader
    //                  runs per pixel every frame, so 1.5 cuts that work by half or more without visibly softening the lines
    ink: {
      drops: 2,
      interval: 0.9,
      dropRadius: 0.03,
      pour: .5,
      spread: 2,
      lineThreshold: 0.6,
      lineLoss: 0.04,
    },
    // The Visuals pour (same meanings as `pour` above). Sizes are fractions of the
    // page width, so on a narrow phone the desktop values make a tiny puff.
    pour: {
      radius: 0.022,
      speed: 0.1,
      seconds: 2.6,
      strength: .3,
    },
  },
}

const PANEL_PAD_ROWS = 1 // rows of glass above and below the hero menu text (whole rows keep the panel on grid lines)
const PANEL_PAD_COLS = 0.5 // columns of glass left of the text (the right edge snaps to the next grid line)
const PANEL_UP_ROWS_PHONE = 1 // phones: grid rows to lift the menu panel above where it would otherwise sit (0 = as on desktop)
const PANEL_LEFT_COLS = 1 // clear grid columns between the page edge and the menu panel (fitted grid only)

const MAX_DROPS = 16
const MAX_TRACES = 16
const MAX_PUFFS = 8 // Visuals pour puffs
const SIM_SCALE = .1 // simulation resolution relative to the page (lower = cheaper, blockier edges)
const SIM_STEPS = 2 // simulation steps per frame

// For the Visuals tiles, which bounce along with the lines (components/ProjectThumbs.jsx).
export const BOUNCE = { seconds: SETTINGS.bounce.seconds, bpm: SETTINGS.bounce.bpm, enabled: SETTINGS.bounce.enabled }

const EASES = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  outStrong: (t) => 1 - Math.pow(1 - t, 5), // faster off the mark, longer and slower settle than 'out'
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), // the most extreme: nearly there at once, then a long crawl
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const c255 = (c) => new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255)

// Deterministic random from the seed, so drop positions are stable between loads.
const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
`

// --- Simulation: R = wetness/pressure. Spreads from wet neighbours, losing pressure
// with distance (more through dense fibres). Grid lines are dams: ink only crosses a
// line where the neighbour's pressure exceeds the threshold, and loses some crossing.
const SIM_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uTexel;       // 1 / sim size
  uniform float uAspect;     // width / height
  uniform float uLoss;       // pressure lost per texel at perm = 1
  uniform float uRate;       // soak rate per second
  uniform float uDt;
  uniform float uFibers;
  uniform float uFiberScale;
  uniform float uSeed;
  uniform float uTime;
  uniform float uDropRadius; // in uv units of width
  uniform float uPour;
  uniform vec4 uDrops[${MAX_DROPS}]; // x, y (uv), landTime, active
  uniform vec4 uPointer;             // x, y (uv), active, strength
  uniform float uPointerRadius;      // in uv units of width
  // grid
  uniform vec2 uSize;        // css px
  uniform vec2 uSpacing;     // css px, per axis (x = column width, y = row height)
  uniform vec2 uOrigin;      // css px: the first grid line on each axis
  uniform vec2 uHx, uVy;     // horizontal x0,x1 and vertical y0,y1 in css px (y down)
  uniform float uDams, uLineThreshold, uLineLoss, uDiffuse;
  ${NOISE_GLSL}

  vec2 toPx(vec2 uv) { return vec2(uv.x, 1.0 - uv.y) * uSize; }
  // Does the step from a to b (css px) cross a grid line that exists there?
  bool crossesLine(vec2 a, vec2 b) {
    // horizontal lines (y = origin.y + k * spacing.y) exist for x in [x0, x1]
    if (floor((a.y - uOrigin.y) / uSpacing.y) != floor((b.y - uOrigin.y) / uSpacing.y)) {
      float x = 0.5 * (a.x + b.x);
      if (x >= uHx.x && x <= uHx.y) return true;
    }
    // vertical lines (x = origin.x + k * spacing.x) exist for y in [y0, y1]
    if (floor((a.x - uOrigin.x) / uSpacing.x) != floor((b.x - uOrigin.x) / uSpacing.x)) {
      float y = 0.5 * (a.y + b.y);
      if (y >= uVy.x && y <= uVy.y) return true;
    }
    return false;
  }
  // Pressure offered by a neighbour, after the dam rule and the distance loss.
  float offer(vec2 uv, vec2 off, float loss) {
    float wn = texture2D(uPrev, uv + off).r;
    if (uDams > 0.5 && crossesLine(toPx(uv), toPx(uv + off))) {
      if (wn < uLineThreshold) return 0.0;
      wn -= uLineLoss;
    }
    return wn - loss;
  }

  void main() {
    float w = texture2D(uPrev, vUv).r;
    vec2 fp = vUv * vec2(uAspect, 1.0) * uFiberScale + uSeed * 3.1;
    float n = fbm(fp) + 0.35 * (vnoise(fp * 3.7) - 0.5);
    float perm = clamp(1.0 + uFibers * (n - 0.5) * 1.8, 0.25, 1.4);
    float loss = uLoss / perm;
    float dl = loss * 1.4142;
    float mx = 0.0;
    mx = max(mx, offer(vUv, vec2( uTexel.x, 0.0), loss));
    mx = max(mx, offer(vUv, vec2(-uTexel.x, 0.0), loss));
    mx = max(mx, offer(vUv, vec2(0.0,  uTexel.y), loss));
    mx = max(mx, offer(vUv, vec2(0.0, -uTexel.y), loss));
    mx = max(mx, offer(vUv, vec2( uTexel.x,  uTexel.y), dl));
    mx = max(mx, offer(vUv, vec2(-uTexel.x,  uTexel.y), dl));
    mx = max(mx, offer(vUv, vec2( uTexel.x, -uTexel.y), dl));
    mx = max(mx, offer(vUv, vec2(-uTexel.x, -uTexel.y), dl));
    float target = max(w, mx);
    // Soak toward the pressure of the wettest neighbour: quick near the source,
    // creeping at the edges, so the front decelerates like real absorption.
    float k = clamp(uRate * uDt * perm * (0.15 + 0.85 * target * target), 0.0, 1.0);
    w += (target - w) * k;
    // Gentle diffusion within the region (never across a dam): softens the front
    // into a gradient and lets thin ink slowly disperse like smoke.
    if (uDiffuse > 0.0) {
      float sum = 0.0, cnt = 0.0;
      vec2 offs[4];
      offs[0] = vec2( uTexel.x, 0.0); offs[1] = vec2(-uTexel.x, 0.0);
      offs[2] = vec2(0.0,  uTexel.y); offs[3] = vec2(0.0, -uTexel.y);
      for (int i = 0; i < 4; i++) {
        if (uDams > 0.5 && crossesLine(toPx(vUv), toPx(vUv + offs[i]))) continue;
        sum += texture2D(uPrev, vUv + offs[i]).r; cnt += 1.0;
      }
      if (cnt > 0.0) w = mix(w, sum / cnt, uDiffuse);
    }
    for (int i = 0; i < ${MAX_DROPS}; i++) {
      vec4 d = uDrops[i];
      if (d.w < 0.5) continue;
      float age = uTime - d.z;
      if (age < 0.0 || age > uPour) continue;
      float dist = length((vUv - d.xy) * vec2(uAspect, 1.0));
      float r = uDropRadius * uAspect * (0.6 + 0.4 * min(1.0, age / 0.25));
      w = max(w, smoothstep(r, r * 0.35, dist));
    }
    if (uPointer.z > 0.5) {
      float dist = length((vUv - uPointer.xy) * vec2(uAspect, 1.0));
      float r = uPointerRadius * uAspect;
      w = max(w, smoothstep(r, r * 0.35, dist) * uPointer.w);
    }
    gl_FragColor = vec4(w, 0.0, 0.0, 1.0);
  }
`

// --- Smoke (the Visuals pour): density carried along a swirling, rising air flow
// (curl noise, so it curls without bunching up), softened a little each step and
// thinning out over time. New smoke comes from the pour puffs: soft blots whose edge
// is pushed in and out by churning noise.
const SMOKE_SCALE = 0.35 // smoke resolution relative to the page
const SMOKE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uTexel;
  uniform float uAspect, uTime, uDt;
  uniform float uFlow, uSwirl, uLift, uFade, uBlur, uRagged;
  uniform vec4 uPuffs[${MAX_PUFFS}]; // x, y (uv), radius (uv of width), amount (0 = off)
  ${NOISE_GLSL}
  // Moving the smoke means re-sampling last frame's smoke a little upstream. Plain
  // (bilinear) sampling smears it a bit every frame, which over a few seconds thins it
  // into an invisible haze no matter how long fade is. Catmull-Rom (cubic) sampling
  // keeps it crisp; clamped to the nearest texels so it never rings.
  vec4 crW(float t) {
    float t2 = t * t, t3 = t2 * t;
    return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
  }
  float sampleCubic(vec2 uv) {
    vec2 px = uv / uTexel - 0.5;
    vec2 f = fract(px);
    vec2 base = (floor(px) + 0.5) * uTexel;
    vec4 wx = crW(f.x), wy = crW(f.y);
    float sum = 0.0, lo = 1e9, hi = -1e9;
    for (int j = 0; j < 4; j++) {
      float row = 0.0;
      for (int i = 0; i < 4; i++) {
        float v = texture2D(uPrev, base + vec2(float(i) - 1.0, float(j) - 1.0) * uTexel).r;
        row += v * (i == 0 ? wx.x : i == 1 ? wx.y : i == 2 ? wx.z : wx.w);
        if (i == 1 || i == 2) if (j == 1 || j == 2) { lo = min(lo, v); hi = max(hi, v); }
      }
      sum += row * (j == 0 ? wy.x : j == 1 ? wy.y : j == 2 ? wy.z : wy.w);
    }
    return clamp(sum, lo, hi);
  }
  float stream(vec2 p) { return fbm(p * uSwirl + vec2(uTime * 0.05, -uTime * 0.04)); }
  void main() {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 p = vUv * asp;
    float e = 0.02;
    vec2 curl = vec2(stream(p + vec2(0.0, e)) - stream(p - vec2(0.0, e)),
                     stream(p - vec2(e, 0.0)) - stream(p + vec2(e, 0.0))) / (2.0 * e);
    vec2 vel = curl / max(0.5, uSwirl) * uFlow + vec2(0.0, uLift); // page heights per second
    float s = sampleCubic(vUv - vel / asp * uDt);
    if (uBlur > 0.0) { // uBlur is per second, so it is the same at any frame rate
      float n = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r
              + texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r + texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
      s = mix(s, n * 0.25, clamp(uBlur * uDt * 60.0, 0.0, 1.0));
    }
    s *= exp(-uDt / max(0.05, uFade));
    for (int i = 0; i < ${MAX_PUFFS}; i++) {
      vec4 pf = uPuffs[i];
      if (pf.w <= 0.0) continue;
      vec2 d = (vUv - pf.xy) * asp;
      float r = pf.z * uAspect;
      float edge = fbm(d / max(1e-4, r) * 1.6 + vec2(uTime * 0.9, -uTime * 0.7) + float(i) * 7.3) - 0.5;
      float dist = length(d) * (1.0 - uRagged * edge * 1.4);
      s = max(s, smoothstep(r, r * 0.3, dist) * pf.w);
    }
    gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
  }
`

// --- Display: background, then ink tinted by the grid colours, then the lines on top.
const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uInk;
  uniform vec2 uSize;        // css px
  uniform float uTime;
  uniform vec3 uBg;
  uniform vec2 uSpacing;     // css px, per axis
  uniform vec2 uOrigin;      // css px: the first grid line on each axis
  uniform float uWeight;
  uniform vec2 uHx, uVy;     // horizontal x0,x1 and vertical y0,y1 in css px (y down)
  uniform vec3 uHFrom, uHTo, uVFrom, uVTo;
  uniform float uInkOn, uRim, uShimmer, uDensity, uSoft, uCloud, uWisps, uDrift;
  uniform float uLineAlpha;  // 0..1 opacity of the grid lines
  uniform float uBgAlpha;    // 1 = solid dark ground, 0 = see-through (a project image sits behind the canvas)
  uniform vec4 uDepth;       // enabled, face, bevel, width
  uniform float uDepthTint;
  uniform float uDepthBars;  // 1 = shade open rows/columns too, 0 = closed cells only
  uniform vec4 uGlow;        // amount 0..1, brightness, thicken px, halo px
  uniform float uGlowHalo;   // halo strength
  uniform vec2 uGlowBand;    // centre x and half-width of the travelling band, css px
  uniform vec4 uTrace[${MAX_TRACES}];     // Contact traces: column x (css px), turn y (css px), from (0 top, 1 bottom), turn (-1 left, 1 right)
  uniform float uTraceLen[${MAX_TRACES}]; // how far each has travelled, css px (0 = not set off)
  uniform vec4 uTraceLook;   // amount 0..1, trail px, brightness, thicken px
  uniform vec2 uTraceHalo;   // halo px, halo strength
  uniform vec3 uTraceFrom, uTraceTo; // colour at the top of the page -> at the bottom
  uniform vec2 uTip;         // tip glow on the growing horizontal lines: trail length css px, amount 0..1
  uniform vec4 uTipGlow;     // brightness, thicken px, halo px, halo strength
  // Glow styles (GLOW_STYLES): x = 1 when the light is a round glow on the leading end
  // (0 = soft light along the lines); for the Systems light, y = 1 when it is lit only
  // behind a leading end (0 = a band, lit both sides of its centre).
  uniform vec2 uGlowKind;
  uniform float uTipKind;
  uniform float uTraceKind;
  uniform vec4 uBounce;      // Visuals bounce: amount 0..1, amplitude (rows), waves across the page, speed
  uniform vec2 uBounceBeat;  // beats per second, kick share 0..1
  uniform float uBounceReach; // furthest a line can travel, in rows (the line loop covers up to 2.5)
  uniform sampler2D uSmoke;  // the Visuals smoke, shaded like the ink
  uniform float uInkAlpha;   // 1 = ink visible, 0 = hidden (the project image covers the smoke; the lines stay on top)
  ${NOISE_GLSL}
  // How far horizontal line k is pushed (roughly -1..1, before amplitude) at x (0..1 across the page).
  float bounceRow(float k, float x, float t) {
    float band = vnoise(vec2(k * 0.61 + 3.0, t * 0.9)); // this line's level, drifting like a frequency band
    float wave = fbm(vec2(x * uBounce.z + k * 5.7, t * uBounce.w + k * 1.3)) - 0.5;
    float kick = exp(-fract(t * uBounceBeat.x + k * 0.03) * 3.0); // sharp hit on the beat, then decay
    return wave * 4.0 * mix(1.0, kick, uBounceBeat.y) * (0.4 + 1.2 * band);
  }
  // Where horizontal line k sits at this x while bouncing, in css px (y down). Peaks are
  // squeezed toward uBounceReach rows, so a line never travels further than that.
  float bounceLineY(float k, float xn) {
    float d = bounceRow(k, xn, uTime) * uBounce.y;
    d = sign(d) * uBounceReach * (1.0 - exp(-abs(d) / uBounceReach));
    return uOrigin.y + (k - d * uBounce.x) * uSpacing.y;
  }
  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize; // css px, y down
    // Premultiplied colour + coverage, so the canvas can be transparent where there is
    // nothing but ground.
    vec3 col = uBg * uBgAlpha;
    float alpha = uBgAlpha;

    // Grid colour at this point (used by the ink and the lines).
    float hx = clamp((px.x - uHx.x) / max(1.0, uHx.y - uHx.x), 0.0, 1.0);
    float vy = clamp((px.y - uVy.x) / max(1.0, uVy.y - uVy.x), 0.0, 1.0);
    vec3 hCol = mix(uHFrom, uHTo, hx);
    vec3 vCol = mix(uVFrom, uVTo, vy);

    // Depth: the whole page is one lifted surface (the tile face) from the start, and
    // the lines cut into it as they grow, bevelling the edges they reach.
    if (uDepth.x > 0.5 && uBgAlpha > 0.5) {
      vec2 cell = fract((px - uOrigin) / uSpacing); // 0..1 across the cell, 0 = top/left line
      float l0 = floor((px.x - uOrigin.x) / uSpacing.x) * uSpacing.x + uOrigin.x, r0 = l0 + uSpacing.x;
      float t0 = floor((px.y - uOrigin.y) / uSpacing.y) * uSpacing.y + uOrigin.y, b0 = t0 + uSpacing.y;
      // Which edges have been reached: horizontal lines give a cell its top and
      // bottom, vertical lines its left and right. Only reached edges are bevelled,
      // so the surface is flat ahead of the lines and carved behind them. With
      // openBars off, a cell waits for both axes before it is cut at all.
      bool hBound = l0 >= uHx.x - 0.5 && r0 <= uHx.y + 0.5; // top and bottom edges
      bool vBound = t0 >= uVy.x - 0.5 && b0 <= uVy.y + 0.5; // left and right edges
      bool cutH = hBound && (uDepthBars > 0.5 || vBound);
      bool cutV = vBound && (uDepthBars > 0.5 || hBound);

      float w = max(0.02, uDepth.w);
      // Distance to each edge, normalised to the bevel width. Edges the lines have
      // not reached read as 1, so they cast no shading and the face stays full.
      float eL = cutV ? smoothstep(0.0, w, cell.x) : 1.0;
      float eR = cutV ? smoothstep(0.0, w, 1.0 - cell.x) : 1.0;
      // While the lines bounce (Visuals) they leave their rows and cross, so the
      // edges they cut flatten out and come back as the lines settle.
      float level = smoothstep(0.0, 0.5, uBounce.x);
      float eT = cutH ? mix(smoothstep(0.0, w, cell.y), 1.0, level) : 1.0;
      float eB = cutH ? mix(smoothstep(0.0, w, 1.0 - cell.y), 1.0, level) : 1.0;
      float face = eL * eR * eT * eB; // 1 in the middle of a tile, 0 at a cut edge
      // Light from the top-left: top/left bevels catch light, bottom/right fall into shadow.
      float light = (1.0 - eT) * 0.6 + (1.0 - eL) * 0.6;
      float shade = (1.0 - eB) * 0.6 + (1.0 - eR) * 0.6;
      vec3 faceCol = mix(vec3(1.0), mix(hCol, vCol, 0.5), uDepthTint);
      col += faceCol * uDepth.y * (0.35 + 0.65 * face);
      col += faceCol * uDepth.y * uDepth.z * 1.6 * light * face;
      col -= faceCol * uDepth.y * uDepth.z * 0.9 * shade;
      col = max(col, uBg * 0.6);
    }

    if (uInkOn > 0.5) {
      vec2 asp = vec2(uSize.x / uSize.y, 1.0);
      vec2 q = vUv * asp;
      float t = uTime * uDrift;
      // Two layers of slow turbulence: large swirls carrying finer curls, like smoke.
      vec2 w1 = vec2(fbm(q * 2.0 + t * 0.07), fbm(q * 2.0 + 5.0 - t * 0.05)) - 0.5;
      vec2 w2 = vec2(fbm(q * 6.0 - t * 0.11 + w1), fbm(q * 6.0 + 9.0 + t * 0.09 + w1)) - 0.5;
      vec2 warp = (w1 * 0.02 + w2 * 0.008) * uShimmer;
      float w = max(texture2D(uInk, vUv + warp / asp).r, texture2D(uSmoke, vUv + warp / asp).r);

      // Soft body: a wide, eased gradient from clear to full instead of a hard stain edge.
      float body = pow(smoothstep(0.0, uSoft, w), 1.6);
      // Cloudy interior: density billows with drifting noise (contrast-stretched so it reads).
      float cloud = smoothstep(0.3, 0.72, fbm(q * 4.0 + t * 0.05 + w2 * 2.5));
      float dens = body * mix(1.0, 0.1 + 0.9 * cloud, uCloud);
      // Wisps: fine noise erodes thin ink into tendrils; the thinner the ink, the more it tears.
      float fine = fbm(q * 12.0 - t * 0.08 + w1 * 3.0);
      float tear = smoothstep(fine * uWisps - 0.15, fine * uWisps + 0.25, body);
      dens *= mix(1.0, tear, uWisps);
      dens = clamp(dens, 0.0, 1.0);

      vec3 inkCol = mix(hCol, vCol, 0.5);
      // A touch brighter where the gas is thin, like light catching the edge.
      float front = (1.0 - body) * smoothstep(0.0, 0.03, w);
      inkCol *= 0.85 + uRim * 0.6 * front;
      // Screen blend so overlapping wisps glow rather than muddy.
      float a = dens * uDensity * uInkAlpha;
      if (uBgAlpha > 0.5) {
        col = 1.0 - (1.0 - col) * (1.0 - min(inkCol, vec3(1.0)) * a);
      } else {
        // Over a see-through ground the ink is plain coverage (screen blending needs a backdrop).
        col = col * (1.0 - a) + min(inkCol, vec3(1.0)) * a;
        alpha = alpha * (1.0 - a) + a;
      }
    }

    // Lines. Lines sit at origin + k*spacing on each axis.
    float aa = 0.7;
    // Only the travelling band glows: a soft bell around its centre.
    float bd = (px.x - uGlowBand.x) / max(1.0, uGlowBand.y);
    float g = uGlow.x * exp(-bd * bd) * (uGlowKind.y > 0.5 ? step(px.x, uGlowBand.x) : 1.0);
    float wt = uWeight + uGlow.z * g; // the lines thicken a little while glowing
    float fh = fract((px.y - uOrigin.y) / uSpacing.y);
    float dh = min(fh, 1.0 - fh) * uSpacing.y;
    if (uBounce.x > 0.001) {
      // Visuals bounce: the lines leave their rows, so look at every line that could
      // reach this pixel (three above, three below) and take the nearest. Distance is
      // measured across the line, not straight down, so steep parts stay full weight.
      float k0 = floor((px.y - uOrigin.y) / uSpacing.y);
      float xn = px.x / uSize.x;
      float pxPerPx = max(1e-4, abs(dFdx(px.x)));
      dh = 1e4;
      for (int j = -2; j <= 3; j++) {
        float ly = bounceLineY(k0 + float(j), xn);
        float slope = dFdx(ly) / pxPerPx;
        dh = min(dh, abs(px.y - ly) / sqrt(1.0 + slope * slope));
      }
    }
    float hMask = step(uHx.x, px.x) * step(px.x, uHx.y);
    // The growing end of the horizontal lines glows too, trailing off behind the tip.
    float td = (uHx.y - px.x) / max(1.0, uTip.x);
    float tg = uTip.y * exp(-td * td);
    float wth = wt + uTipGlow.y * tg;
    float hLine = (1.0 - smoothstep(wth * 0.5 - aa, wth * 0.5 + aa, dh)) * hMask;
    float fv = fract((px.x - uOrigin.x) / uSpacing.x);
    float dv = min(fv, 1.0 - fv) * uSpacing.x;
    float vMask = step(uVy.x, px.y) * step(px.y, uVy.y);
    float vLine = (1.0 - smoothstep(wt * 0.5 - aa, wt * 0.5 + aa, dv)) * vMask;
    hLine *= uLineAlpha;
    vLine *= uLineAlpha;
    vec3 hLit = hCol * (1.0 + uGlow.y * g + uTipGlow.x * tg);
    vec3 vLit = vCol * (1.0 + uGlow.y * g);
    // Glow halo: soft light falling off either side of each line, added on top.
    if (g > 0.001 && uGlowKind.x < 0.5) {
      float r = max(0.5, uGlow.w * g);
      float hH = exp(-dh / r) * hMask * uLineAlpha;
      float vH = exp(-dv / r) * vMask * uLineAlpha;
      vec3 halo = (hCol * hH + vCol * vH) * uGlowHalo * g;
      col += halo;
      alpha = min(1.0, alpha + max(hH, vH) * uGlowHalo * g);
    }
    // Systems light as a round glow: one on each horizontal line, where the light's
    // leading end is (only where there is a line to carry it).
    if (uGlow.x > 0.001 && uGlowKind.x > 0.5) {
      float d = length(vec2(px.x - uGlowBand.x, dh));
      float pH = exp(-d / max(0.5, uGlow.w)) * uGlowHalo * uGlow.x * uLineAlpha * step(uHx.x, uGlowBand.x) * step(uGlowBand.x, uHx.y);
      col += hCol * pH;
      alpha = min(1.0, alpha + pH);
    }
    // Tip halo. Along the lines: measured from the line's end past the tip, so it rounds
    // off there. Round glow: a point of light sitting on the tip itself.
    if (uTip.y > 0.001) {
      float tH = 0.0;
      if (uTipKind > 0.5) {
        float d = length(vec2(px.x - uHx.y, dh));
        tH = exp(-d / max(0.5, uTipGlow.z)) * uLineAlpha * uTipGlow.w * uTip.y;
      } else if (tg > 0.001) {
        float r = max(0.5, uTipGlow.z * tg);
        float d = length(vec2(max(px.x - uHx.y, 0.0), dh));
        tH = exp(-d / r) * step(uHx.x, px.x) * uLineAlpha * uTipGlow.w * tg;
      }
      col += hCol * tH;
      alpha = min(1.0, alpha + tH);
    }
    col = mix(col, min(hLit, vec3(1.0)), hLine);
    alpha = mix(alpha, 1.0, hLine);
    col = mix(col, min(vLit, vec3(1.0)), vLine);
    alpha = mix(alpha, 1.0, vLine);

    // Contact traces: each runs along a column from the top or bottom edge to its turn
    // row, then along that row to the side of the page. Lit near the leading end.
    if (uTraceLook.x > 0.001) {
      vec3 tCol = mix(uTraceFrom, uTraceTo, clamp(px.y / uSize.y, 0.0, 1.0));
      float ta = uTraceLook.x * uLineAlpha;
      for (int i = 0; i < ${MAX_TRACES}; i++) {
        float len = uTraceLen[i];
        if (len <= 0.0) continue;
        vec4 tr = uTrace[i];
        float y0 = tr.z * uSize.y;
        float sgn = 1.0 - 2.0 * tr.z;
        float lenV = abs(tr.y - y0);                       // the column part
        float lenH = tr.w > 0.0 ? uSize.x - tr.x : tr.x;   // the row part, to the page edge
        float done = min(len, lenV + lenH);
        float lv = min(done, lenV);
        float lh = max(0.0, done - lenV);
        float sV = (px.y - y0) * sgn;  // how far along the column this pixel is
        float sH = (px.x - tr.x) * tr.w; // and along the row
        float onV = step(0.0, sV) * step(sV, lv);
        float onH = step(0.0, sH) * step(sH, lh) * step(0.5, lh);
        vec2 tip = done < lenV ? vec2(tr.x, y0 + sgn * lv) : vec2(tr.x + tr.w * lh, tr.y);
        float live = clamp((lenV + lenH - len) / 80.0, 0.0, 1.0); // the light goes out as it reaches the edge
        float bV = (done - sV) / uTraceLook.y;
        float bH = (done - lenV - sH) / uTraceLook.y;
        float gV = exp(-bV * bV) * live;
        float gH = exp(-bH * bH) * live;
        float wV = uWeight + uTraceLook.w * gV;
        float wH = uWeight + uTraceLook.w * gH;
        float lineV = (1.0 - smoothstep(wV * 0.5 - aa, wV * 0.5 + aa, abs(px.x - tr.x))) * onV * ta;
        float lineH = (1.0 - smoothstep(wH * 0.5 - aa, wH * 0.5 + aa, abs(px.y - tr.y))) * onH * ta;
        float halo = exp(-length(px - tip) / max(0.5, uTraceHalo.x)) * uTraceHalo.y * live * ta;
        if (uTraceKind < 0.5) {
          // Soft light along the lit stretch of the line instead of a round glow on its end.
          float hV = exp(-abs(px.x - tr.x) / max(0.5, uTraceHalo.x * gV)) * gV * onV;
          float hHz = exp(-abs(px.y - tr.y) / max(0.5, uTraceHalo.x * gH)) * gH * onH;
          halo = max(hV, hHz) * uTraceHalo.y * ta;
        }
        col += tCol * halo;
        alpha = min(1.0, alpha + halo);
        col = mix(col, min(tCol * (1.0 + uTraceLook.z * gV), vec3(1.0)), lineV);
        alpha = mix(alpha, 1.0, lineV);
        col = mix(col, min(tCol * (1.0 + uTraceLook.z * gH), vec3(1.0)), lineH);
        alpha = mix(alpha, 1.0, lineH);
      }
    }
    gl_FragColor = vec4(col, alpha);
  }
`

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export default function GridInkBackdrop({ className = '', transparent = false, palette = null, lineOpacity = 1, glow = 0, pour = 0, bounce = false, trace = false }) {
  const host = useRef(null)
  const dispMatRef = useRef(null)
  // Requests for the render loop: performance.now() of the latest glow / pour (-1 = none).
  const glowAt = useRef(-1)
  const pourAt = useRef(-1)
  // When the Visuals bounce should stop (performance.now(); -1 = not running); the render
  // loop eases toward it. Leaving Visuals early stops it straight away.
  const bounceUntil = useRef(-1)
  // Whether the Contact traces should be showing; the render loop draws a new set each time it turns on.
  const traceOn = useRef(false)
  useEffect(() => { traceOn.current = trace }, [trace])
  useEffect(() => { bounceUntil.current = bounce ? performance.now() + SETTINGS.bounce.seconds * 1000 : -1 }, [bounce])

  // `glow` / `pour` are counters: each increase (a SYSTEMS / VISUALS menu click) plays one
  // glow sweep / one pour. 0 = never played yet, so nothing runs on page load.
  useEffect(() => { if (glow) glowAt.current = performance.now() }, [glow])
  useEffect(() => { if (pour && SETTINGS.pour.enabled) pourAt.current = performance.now() }, [pour])

  // Line opacity: ease toward `lineOpacity` (1 = solid, 0 = invisible).
  useEffect(() => {
    const mat = dispMatRef.current
    if (!mat) return undefined
    let raf = 0
    const tick = () => {
      const u = mat.uniforms.uLineAlpha
      u.value += (lineOpacity - u.value) * 0.12
      if (Math.abs(u.value - lineOpacity) < 0.004) {
        u.value = lineOpacity
        return
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [lineOpacity])

  // Line colours: ease toward `palette` ({ hFrom, hTo, vFrom, vTo } as [r,g,b] 0..255,
  // e.g. sampled from a project image) or back to the SETTINGS colours.
  useEffect(() => {
    const mat = dispMatRef.current
    if (!mat) return undefined
    const S = SETTINGS
    const targets = {
      uHFrom: c255(palette?.hFrom ?? S.horizontal.colors.from),
      uHTo: c255(palette?.hTo ?? S.horizontal.colors.to),
      uVFrom: c255(palette?.vFrom ?? S.vertical.colors.from),
      uVTo: c255(palette?.vTo ?? S.vertical.colors.to),
    }
    let raf = 0
    const tick = () => {
      let done = true
      for (const [name, t] of Object.entries(targets)) {
        const v = mat.uniforms[name].value
        v.lerp(t, 0.1)
        if (v.distanceTo(t) > 0.002) done = false
        else v.copy(t)
      }
      if (!done) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [palette])

  // Fade the dark ground out (so whatever sits behind the canvas shows through, with
  // the grid lines and ink drawn over it) or back in.
  useEffect(() => {
    const mat = dispMatRef.current
    if (!mat) return undefined
    const target = transparent ? 0 : 1
    let raf = 0
    const tick = () => {
      const u = mat.uniforms.uBgAlpha
      const ink = mat.uniforms.uInkAlpha
      u.value += (target - u.value) * 0.12
      ink.value += (target - ink.value) * 0.18 // the smoke goes a touch faster than the ground
      if (Math.abs(u.value - target) < 0.005 && Math.abs(ink.value - target) < 0.005) { u.value = target; ink.value = target; return }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [transparent])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const S = SETTINGS
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const phone = window.matchMedia(`(max-width: ${S.phone.maxWidth}px)`).matches
    const INK = phone ? { ...S.ink, ...S.phone.ink } : S.ink
    const POUR = phone ? { ...S.pour, ...S.phone.pour } : S.pour

    // Remove any canvas a previous mount left behind (React StrictMode mounts twice).
    el.querySelectorAll('canvas').forEach((c) => c.remove())

    // If WebGL is unavailable (very old browser, blocked GPU), leave the plain dark
    // ground rather than taking the page down.
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
    } catch (err) {
      console.warn('GridInkBackdrop: WebGL unavailable, showing a plain backdrop.', err)
      return undefined
    }
    renderer.setPixelRatio(Math.min(phone ? S.phone.pixelRatio : 2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    scene.add(quad)

    const drops = Array.from({ length: MAX_DROPS }, () => new THREE.Vector4(0, 0, 0, 0))
    const simMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uLoss: { value: 0.01 },
        uRate: { value: 6 },
        uDt: { value: 1 / 60 },
        uFibers: { value: INK.fibers },
        uFiberScale: { value: INK.fiberScale },
        uSeed: { value: INK.seed },
        uTime: { value: 0 },
        uDropRadius: { value: INK.dropRadius },
        uPour: { value: INK.pour },
        uDrops: { value: drops },
        uPointer: { value: new THREE.Vector4(0, 0, 0, 0) },
        uPointerRadius: { value: S.ink.paint.radius },
        uSize: { value: new THREE.Vector2() },
        uSpacing: { value: new THREE.Vector2(30, 30) },
        uOrigin: { value: new THREE.Vector2(15, 15) },
        uHx: { value: new THREE.Vector2() },
        uVy: { value: new THREE.Vector2() },
        uDams: { value: INK.dams ? 1 : 0 },
        uLineThreshold: { value: INK.lineThreshold },
        uLineLoss: { value: INK.lineLoss },
        uDiffuse: { value: INK.diffuse },
      },
    })
    const dispMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uInk: { value: null },
        uSize: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uBg: { value: c255(S.background) },
        uSpacing: { value: new THREE.Vector2(30, 30) },
        uOrigin: { value: new THREE.Vector2(15, 15) },
        uWeight: { value: S.weight },
        uHx: { value: new THREE.Vector2() },
        uVy: { value: new THREE.Vector2() },
        uHFrom: { value: c255(S.horizontal.colors.from) },
        uHTo: { value: c255(S.horizontal.colors.to) },
        uVFrom: { value: c255(S.vertical.colors.from) },
        uVTo: { value: c255(S.vertical.colors.to) },
        uInkOn: { value: INK.enabled ? 1 : 0 },
        uRim: { value: INK.rim },
        uShimmer: { value: INK.shimmer },
        uDrift: { value: still ? 0 : INK.drift },
        uDensity: { value: INK.density },
        uSoft: { value: INK.softness },
        uCloud: { value: INK.cloudiness },
        uWisps: { value: INK.wisps },
        uBgAlpha: { value: 1 },
        uInkAlpha: { value: 1 },
        uDepth: { value: new THREE.Vector4(S.depth.enabled ? 1 : 0, S.depth.face, S.depth.bevel, S.depth.width) },
        uDepthTint: { value: S.depth.tint },
        uDepthBars: { value: S.depth.openBars ? 1 : 0 },
        uLineAlpha: { value: 1 },
        uGlow: { value: new THREE.Vector4(0, glowLook('systems').brightness, glowLook('systems').thicken, glowLook('systems').halo) },
        uGlowHalo: { value: glowLook('systems').haloStrength },
        uGlowKind: { value: new THREE.Vector2(glowLook('systems').light === 'point' ? 1 : 0, glowLook('systems').shape === 'tip' ? 1 : 0) },
        uTipKind: { value: glowLook('load').light === 'point' ? 1 : 0 },
        uTraceKind: { value: glowLook('contact').light === 'point' ? 1 : 0 },
        uSmoke: { value: null },
        uGlowBand: { value: new THREE.Vector2(-1e4, 1) },
        uTip: { value: new THREE.Vector2(1, 0) },
        uTrace: { value: Array.from({ length: MAX_TRACES }, () => new THREE.Vector4(0, 0, 0, 1)) },
        uTraceLen: { value: new Array(MAX_TRACES).fill(0) },
        uTraceLook: { value: new THREE.Vector4(0, 1, glowLook('contact').brightness, glowLook('contact').thicken) },
        uTraceHalo: { value: new THREE.Vector2(glowLook('contact').halo, glowLook('contact').haloStrength) },
        uTraceFrom: { value: c255(S.trace.colors.from) },
        uTraceTo: { value: c255(S.trace.colors.to) },
        uBounce: { value: new THREE.Vector4(0, S.bounce.amplitude, S.bounce.waves, S.bounce.speed) },
        uBounceBeat: { value: new THREE.Vector2(S.bounce.bpm / 60, S.bounce.kick) },
        uBounceReach: { value: Math.min(2.5, Math.max(0.1, S.bounce.reach)) },
        uTipGlow: { value: new THREE.Vector4(glowLook('load').brightness, glowLook('load').thicken, glowLook('load').halo, glowLook('load').haloStrength) },
      },
    })
    dispMatRef.current = dispMat
    // Dev only: try a palette live from the console, e.g.
    //   __setGridColors({ hFrom:[r,g,b], hTo:[..], vFrom:[..], vTo:[..], bg:[..] })
    if (import.meta.env.DEV) {
      window.__setGridColors = (c = {}) => {
        if (c.hFrom) dispMat.uniforms.uHFrom.value.copy(c255(c.hFrom))
        if (c.hTo) dispMat.uniforms.uHTo.value.copy(c255(c.hTo))
        if (c.vFrom) dispMat.uniforms.uVFrom.value.copy(c255(c.vFrom))
        if (c.vTo) dispMat.uniforms.uVTo.value.copy(c255(c.vTo))
        if (c.bg) dispMat.uniforms.uBg.value.copy(c255(c.bg))
        if (c.depth) dispMat.uniforms.uDepth.value.set(c.depth.enabled === false ? 0 : 1, c.depth.face ?? S.depth.face, c.depth.bevel ?? S.depth.bevel, c.depth.width ?? S.depth.width)
        if (c.depth && c.depth.tint !== undefined) dispMat.uniforms.uDepthTint.value = c.depth.tint
        if (c.depth && c.depth.openBars !== undefined) dispMat.uniforms.uDepthBars.value = c.depth.openBars ? 1 : 0
      }
    }
    const gridMats = [simMat, dispMat]
    const smokeMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uFlow: { value: POUR.flow },
        uSwirl: { value: POUR.swirl },
        uLift: { value: POUR.lift },
        uFade: { value: POUR.fade },
        uBlur: { value: POUR.blur },
        uRagged: { value: POUR.ragged },
        uPuffs: { value: Array.from({ length: MAX_PUFFS }, () => new THREE.Vector4()) },
      },
    })

    let rtA = null
    let rtB = null
    let smA = null
    let smB = null
    let cssW = 1
    let cssH = 1
    const makeTargets = () => {
      rtA?.dispose()
      rtB?.dispose()
      const sw = Math.max(16, Math.round(cssW * SIM_SCALE))
      const sh = Math.max(16, Math.round(cssH * SIM_SCALE))
      const opts = {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      }
      rtA = new THREE.WebGLRenderTarget(sw, sh, opts)
      rtB = new THREE.WebGLRenderTarget(sw, sh, opts)
      simMat.uniforms.uTexel.value.set(1 / sw, 1 / sh)
      simMat.uniforms.uAspect.value = sw / sh
      // spread 1 ≈ a quarter of the page width before the pressure runs out
      simMat.uniforms.uLoss.value = 1 / Math.max(1, 0.25 * INK.spread * sw)
      // Smoke: its own pair, simply cleared on resize (it fades away anyway).
      smA?.dispose()
      smB?.dispose()
      const mw = Math.max(16, Math.round(cssW * SMOKE_SCALE))
      const mh = Math.max(16, Math.round(cssH * SMOKE_SCALE))
      smA = new THREE.WebGLRenderTarget(mw, mh, opts)
      smB = new THREE.WebGLRenderTarget(mw, mh, opts)
      smokeMat.uniforms.uTexel.value.set(1 / mw, 1 / mh)
      smokeMat.uniforms.uAspect.value = mw / mh
      for (const t of [rtA, rtB, smA, smB]) {
        renderer.setRenderTarget(t)
        renderer.clear()
      }
      renderer.setRenderTarget(null)
    }

    let simW = -1
    let simH = -1
    const resize = () => {
      cssW = Math.max(1, el.clientWidth)
      cssH = Math.max(1, el.clientHeight)
      renderer.setSize(cssW, cssH, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      let spacing = Math.min(S.maxSpacing, Math.max(S.minSpacing, Math.min(cssW, cssH) * S.spacing))
      // The grid follows the hero text: one row per line of the menu (all screen sizes).
      const link = el.closest('.section')?.querySelector('.hero_menu_text_color')
      if (S.rowsFromText > 0 && link) {
        const fs = parseFloat(getComputedStyle(link).fontSize)
        if (fs > 0) spacing = Math.round(fs * S.rowsFromText)
      }
      // Fit the grid to the page: round the cell size so a whole number of cells spans
      // the width and the height, and put the first line on the page edge. Otherwise
      // keep square cells with the first line half a cell in (the original grid).
      let spacingX = spacing
      let spacingY = spacing
      let originX = spacing / 2
      let originY = spacing / 2
      if (S.fitToPage) {
        spacingX = cssW / Math.max(1, Math.round(cssW / spacing))
        spacingY = cssH / Math.max(1, Math.round(cssH / spacing))
        originX = 0
        originY = 0
      }
      spacing = spacingX // what the CSS calls --grid-spacing
      gridMats.forEach((m) => {
        m.uniforms.uSize.value.set(cssW, cssH)
        m.uniforms.uSpacing.value.set(spacingX, spacingY)
        m.uniforms.uOrigin.value.set(originX, originY)
      })
      // Tell the CSS about the grid so the hero menu panel can sit on it: the text
      // takes one row per line, and the glass panel's edges land on grid lines with
      // PANEL_PAD_ROWS rows of glass above/below the text and PANEL_PAD_COLS columns
      // either side. Lines sit at spacing/2 + k*spacing on both axes.
      const section = el.closest('.section')
      if (section) {
        const LX = (k) => originX + k * spacingX
        const LY = (k) => originY + k * spacingY
        const padTop = parseFloat(getComputedStyle(section).paddingTop) || 0
        const panel = section.querySelector('.header.margin-bottom_none')
        section.style.setProperty('--grid-spacing', `${spacingX}px`)
        section.style.setProperty('--grid-spacing-y', `${spacingY}px`)
        section.style.setProperty('--grid-origin-x', `${originX}px`)
        section.style.setProperty('--grid-origin-y', `${originY}px`)
        // Line thickness, so the tiles can stop short of the lines (--thumb-gap in custom.css).
        section.style.setProperty('--grid-line-weight', `${S.weight}px`)
        if (panel) {
          const phone = window.matchMedia('(max-width: 767px)').matches
          const topRow = Math.floor((padTop - originY) / spacingY) // line at or just above the section padding
          const top = LY(Math.max(0, topRow - (phone ? PANEL_UP_ROWS_PHONE : 0)))
          // Fitted grid: start the panel PANEL_LEFT_COLS whole columns in from the page
          // edge. Unfitted grid: the first line already sits half a cell in, so use the
          // line nearest the stylesheet's 20px margin.
          const left = S.fitToPage
            ? LX(PANEL_LEFT_COLS)
            : LX(Math.max(0, Math.round((20 - originX) / spacingX)))
          // Natural text width, independent of the panel's current width (the panel is
          // let go to its content width while measuring, so text that wraps inside the
          // current panel is measured unwrapped).
          let textW = 0
          const prevWidth = panel.style.width
          panel.style.width = 'max-content'
          panel.querySelectorAll('.hero_menu_text_color').forEach((a) => {
            const r = document.createRange()
            r.selectNodeContents(a)
            textW = Math.max(textW, r.getBoundingClientRect().width)
          })
          panel.style.width = prevWidth
          const padX = spacingX * PANEL_PAD_COLS
          const lastLine = LX(Math.floor((cssW - originX) / spacingX + 1e-6)) // last grid line on screen
          const right = Math.min(lastLine, LX(Math.ceil((left + padX + textW + padX - originX) / spacingX))) // next line past the text
          //    (phones: a project title wider than the screen wraps inside the panel instead; custom.css)
          section.style.setProperty('--hero-panel-top', `${(top - padTop).toFixed(2)}px`)
          section.style.setProperty('--hero-panel-left', `${left.toFixed(2)}px`)
          section.style.setProperty('--hero-panel-width', `${(right - left).toFixed(2)}px`)
          section.style.setProperty('--hero-panel-pad-x', `${padX.toFixed(2)}px`)
          section.style.setProperty('--hero-panel-pad-y', `${(spacingY * PANEL_PAD_ROWS).toFixed(2)}px`)
        }
      }
      // Only rebuild the simulation when the canvas size actually changed. Panel
      // content changes (menu <-> project title) re-run this for the grid/panel
      // measurements above but must not reset the smoke.
      if (cssW !== simW || cssH !== simH) {
        simW = cssW
        simH = cssH
        makeTargets()
        // Drops that already landed re-land so the stain rebuilds at the new size.
        for (const d of landed) d.time = clock() - 0.001
      }
    }

    const t0 = performance.now()
    const clock = () => (performance.now() - t0) / 1000

    // Virtual scroll: accumulate wheel / touch / key input into px, without the page moving.
    let virtualPx = 0
    const virtualRange = () => Math.max(1, window.innerHeight * S.scroll.range)
    // Sweeps: each gesture starts one full run of the lines, alternating down / up.
    const sweep = { active: false, from: 0, to: 1, start: 0, at: 0, pending: 0 }
    // Where in the loop cycle a scroll position (in ranges) sits: 'down' | 'holdBottom' | 'up' | 'holdTop'
    const cycleLen = () => 2 + 2 * (S.scroll.dwell || 0)
    const phaseOf = (t) => {
      const d = S.scroll.dwell || 0
      const c = ((t % cycleLen()) + cycleLen()) % cycleLen()
      if (c < 1) return { seg: 'down', p: c }
      if (c < 1 + d) return { seg: 'holdBottom', p: 1 }
      if (c < 2 + d) return { seg: 'up', p: 1 - (c - 1 - d) }
      return { seg: 'holdTop', p: 0 }
    }
    const bump = (dy) => {
      if (S.scroll.mode === 'virtual' && S.scroll.loop && S.scroll.finishFirst && !S.scroll.sweep.enabled) {
        // Mid-travel, only input that continues the current direction counts.
        const { seg } = phaseOf(virtualPx / virtualRange())
        if ((seg === 'down' || seg === 'up') && dy < 0) return
      }
      if (S.scroll.sweep.enabled) {
        if (sweep.active) return // ignore input mid-sweep
        sweep.pending += dy
        if (Math.abs(sweep.pending) >= S.scroll.sweep.threshold) {
          sweep.pending = 0
          sweep.from = sweep.at
          sweep.to = sweep.at >= 0.5 ? 0 : 1 // alternate: at the bottom -> go up, else -> go down
          if (!S.scroll.loop && sweep.at >= 0.5) return // no loop: stay at the bottom
          sweep.start = clock()
          sweep.active = true
        }
        virtualPx += Math.abs(dy) // still counts as "has scrolled" for the triggers
        return
      }
      virtualPx = Math.max(0, virtualPx + dy)
      if (!S.scroll.loop) virtualPx = Math.min(virtualRange(), virtualPx)
    }
    // Scrolling inside a panel (the write-up, the photo viewer) belongs to that panel,
    // not to the backdrop animation.
    const inPanel = (t) => !!(t && t.closest && t.closest('.writeup, .lightbox, .resume_scroll'))
    const onWheel = (e) => {
      if (S.scroll.mode !== 'virtual' || inPanel(e.target)) return
      e.preventDefault()
      bump(e.deltaY)
    }
    let touchY = null
    let touchInPanel = false
    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null
      touchInPanel = inPanel(e.target)
    }
    const onTouchMove = (e) => {
      if (S.scroll.mode !== 'virtual' || touchY === null || touchInPanel) return
      const y = e.touches[0]?.clientY ?? touchY
      bump((touchY - y) * 1.5)
      touchY = y
      e.preventDefault()
    }
    const keyDelta = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4, ' ': 4, End: 100, Home: -100 }
    const onVirtualKey = (e) => {
      if (S.scroll.mode !== 'virtual' || !(e.key in keyDelta) || e.target.closest('input, textarea') || inPanel(e.target)) return
      e.preventDefault()
      bump(keyDelta[e.key] * S.scroll.keyStep * virtualRange())
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onVirtualKey)

    // 0 at the start, 1 when the hero's scroll (virtual or pinned) is used up. In loop
    // mode the input folds into a triangle wave: 0 -> 1 over one range, 1 -> 0 over the
    // next, forever, so the lines grow down, retract up, and repeat as you keep scrolling.
    const scrollProgress = () => {
      if (S.scroll.mode === 'virtual' && S.scroll.sweep.enabled) {
        if (sweep.active) {
          const ease = EASES[S.scroll.sweep.ease] || EASES.inOut
          const t = clamp01((clock() - sweep.start) / Math.max(0.05, S.scroll.sweep.seconds))
          sweep.at = sweep.from + (sweep.to - sweep.from) * ease(t)
          if (t >= 1) { sweep.at = sweep.to; sweep.active = false }
        }
        return sweep.at
      }
      if (S.scroll.mode === 'virtual') {
        const t = virtualPx / virtualRange()
        if (!S.scroll.loop) return clamp01(t)
        return phaseOf(t).p
      }
      const section = el.closest('.section')
      const spacer = section?.parentElement
      let dist = (spacer?.offsetHeight || 0) - (section?.offsetHeight || 0)
      if (dist < 10) dist = window.innerHeight
      return clamp01(window.scrollY / dist)
    }

    let scrollSmooth = 0
    let scrollRaw = 0
    const rng = INK.randomPositions ? Math.random : mulberry32(INK.seed * 7919 + 13)
    const dropPlan = Array.from({ length: Math.min(MAX_DROPS, INK.drops) }, (_, i) => ({
      i,
      rx: 0.08 + rng() * 0.84,
      ry: 0.08 + rng() * 0.84,
    }))
    const landed = []
    let startedAt = -1 // seconds when the drop sequence began; -1 = not yet

    // Scroll lock: set on the first scroll, released when the line animation is done.
    let lockStart = -1 // seconds when the first scroll happened; -1 = not yet
    const lock = { active: false, y: 0 }
    const stopScroll = (e) => { if (lock.active) e.preventDefault() }
    const scrollKeys = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'])
    const stopKeys = (e) => { if (lock.active && scrollKeys.has(e.key)) e.preventDefault() }
    const holdPosition = () => { if (lock.active && Math.abs(window.scrollY - lock.y) > 0.5) window.scrollTo(0, lock.y) }
    window.addEventListener('wheel', stopScroll, { passive: false })
    window.addEventListener('touchmove', stopScroll, { passive: false })
    window.addEventListener('keydown', stopKeys)
    window.addEventListener('scroll', holdPosition)
    const hProgressAtLock = { value: 0 }

    // Painting: pointer down adds ink at the pointer; holding keeps pouring, dragging
    // paints. Listeners sit on the hero section so clicks on the glass count too;
    // clicks on the menu links are left alone.
    const pointer = { down: false, x: 0, y: 0, until: 0 }
    const pour = { at: -1, puffs: [] } // the current Visuals pour: its puffs (sim uv, y up)
    let lastFrame = -1
    const paintHost = el.closest('.section') || el
    const toUv = (e) => {
      const r = paintHost.getBoundingClientRect()
      pointer.x = clamp01((e.clientX - r.left) / r.width)
      pointer.y = 1 - clamp01((e.clientY - r.top) / r.height)
    }
    const onDown = (e) => {
      if (!S.ink.paint.enabled || still || e.button > 0 || e.target.closest('a')) return
      toUv(e)
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        pointer.down = true
      } else {
        pointer.until = clock() + S.ink.pour // touch: a tap pours for one drop's worth
      }
    }
    const onMove = (e) => { if (pointer.down) toUv(e) }
    const onUp = () => { pointer.down = false }
    paintHost.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    const progressFor = (cfg, seconds, raw = false) => {
      if (still) return 1
      const ease = EASES[cfg.ease] || EASES.linear
      let p = 0
      if (cfg.growth === 'time') {
        p = ease(clamp01(seconds / cfg.seconds))
        if (!raw && cfg.finishWithLock && lockStart >= 0) {
          // Catch up: finish by the end of the lock, continuing from where we were.
          const t = clamp01((seconds - lockStart) / Math.max(0.01, S.scrollLock.seconds))
          p = Math.max(p, hProgressAtLock.value + (1 - hProgressAtLock.value) * EASES.inOut(t))
        }
      } else if (cfg.growth === 'onScroll') {
        p = lockStart < 0 ? 0 : ease(clamp01((seconds - lockStart) / cfg.seconds))
      } else if (cfg.growth === 'scroll') {
        // Smoothed scroll, so wheel clicks don't make the lines jump. The small lag is
        // covered by the pause after scrollRange, so the lines still finish before release.
        p = ease(clamp01(scrollSmooth / cfg.scrollRange))
      }
      return p
    }
    const extentFor = (cfg, size, progress) => {
      const length = cfg.initialLength + (cfg.finalLength - cfg.initialLength) * progress
      const a = cfg.start * size
      return [a, Math.min(size, a + length * size)]
    }

    const landDrop = (plan, x1, y1, now) => {
      const inGrid = INK.area === 'grid'
      const x = inGrid ? (plan.rx * x1) / cssW : plan.rx
      const y = inGrid ? (plan.ry * y1) / cssH : plan.ry
      landed.push({ plan, x, y: 1 - y, time: now }) // sim uv has y up
    }

    let bounceAmount = 0
    // Contact traces: the current set (each { delay } seconds after `at`), and how visible they are.
    const traces = { list: null, on: false, at: 0, amount: 0, w: 0, h: 0 }
    const newTraces = (seconds) => {
      const sp = dispMat.uniforms.uSpacing.value
      const og = dispMat.uniforms.uOrigin.value
      const cols = Math.floor((cssW - og.x) / sp.x + 1e-6)
      const rows = Math.floor((cssH - og.y) / sp.y + 1e-6)
      // Line n: down column firstColumn + n * columnStep, turning right at a row
      // `rowStep` higher than the one before, while there are columns and rows left.
      const T = S.trace
      traces.list = []
      for (let n = 0; n < Math.min(MAX_TRACES, T.count); n++) {
        const col = T.firstColumn + n * Math.max(1, T.columnStep)
        const row = rows - T.lowestRow - n * Math.max(1, T.rowStep)
        if (col >= cols || row < 1) break
        dispMat.uniforms.uTrace.value[n].set(og.x + col * sp.x, og.y + row * sp.y, 0, 1)
        traces.list.push({ delay: n * T.stagger })
      }
      traces.at = seconds
      traces.w = cssW
      traces.h = cssH
    }
    let bounceSeconds = 0 // clock at the previous frame
    let tipX = -1 // where the horizontal lines ended last frame (-1 = first frame)
    let tipAmount = 0
    const step = (seconds) => {
      // Lines
      const target = still ? 1 : scrollProgress()
      scrollRaw = target
      scrollSmooth += (target - scrollSmooth) * (still || S.scroll.sweep.enabled ? 1 : S.scrollSmoothing)
      // First scroll: start the line animation and (optionally) hold the page.
      const moved = S.scroll.mode === 'virtual' ? virtualPx / virtualRange() : target
      if (!still && lockStart < 0 && moved >= S.scrollLock.scrollStart) {
        lockStart = seconds
        hProgressAtLock.value = progressFor(S.horizontal, seconds, true)
        if (S.scrollLock.enabled) {
          lock.active = true
          lock.y = window.scrollY
        }
      }
      if (lock.active && seconds - lockStart >= S.scrollLock.seconds) lock.active = false
      const [x0, x1] = extentFor(S.horizontal, cssW, progressFor(S.horizontal, seconds))
      const [y0, y1] = extentFor(S.vertical, cssH, progressFor(S.vertical, seconds))
      gridMats.forEach((m) => {
        m.uniforms.uHx.value.set(x0, x1)
        m.uniforms.uVy.value.set(y0, y1)
      })
      dispMat.uniforms.uTime.value = seconds

      // Drops: the sequence starts once (on the first scroll, or on load), then the
      // drops keep landing on their own every `interval` seconds.
      if (INK.enabled && INK.trigger !== 'none') {
        if (startedAt < 0) {
          const start = still || INK.trigger === 'time' || (INK.trigger === 'scroll' && (lockStart >= 0 || moved >= INK.scrollStart))
          if (start) startedAt = still ? 0 : seconds
        }
        if (startedAt >= 0) {
          for (const plan of dropPlan) {
            if (landed.some((d) => d.plan === plan)) continue
            if (still || seconds - startedAt >= plan.i * INK.interval) landDrop(plan, x1, y1, still ? 0 : seconds)
          }
        }
        landed.forEach((d, n) => drops[n].set(d.x, d.y, d.time, 1))
        for (let n = landed.length; n < MAX_DROPS; n++) drops[n].w = 0
      }

      // Pointer ink
      const painting = pointer.down || seconds < pointer.until
      simMat.uniforms.uPointer.value.set(pointer.x, pointer.y, painting ? 1 : 0, S.ink.paint.strength)

      // Systems glow: a band sweeping left to right, starting and ending off the page.
      let g = 0
      if (glowAt.current >= 0) {
        const t = (performance.now() - glowAt.current) / 1000 / S.glow.seconds
        if (t < 1) {
          const look = glowLook('systems')
          if (look.shape === 'tip') {
            // A leading end crossing the page with its light trailing behind; it runs on
            // past the right edge until the trail has left too.
            const trail = Math.max(1, look.length * cssW)
            dispMat.uniforms.uGlowBand.value.set((cssW + 2.5 * trail) * EASES.inOut(t), trail)
          } else {
            const half = 0.5 * look.length * cssW
            dispMat.uniforms.uGlowBand.value.set(-2 * half + (cssW + 4 * half) * EASES.inOut(t), half)
          }
          g = 1
        } else glowAt.current = -1
      }
      dispMat.uniforms.uGlow.value.x = g

      // Tip glow: on while the horizontal lines' end is moving, easing off as it stops.
      const tipMoving = S.tipGlow.enabled && tipX >= 0 && Math.abs(x1 - tipX) > 0.05 && x1 < cssW - 0.5
      tipX = x1
      tipAmount += ((tipMoving ? 1 : 0) - tipAmount) * S.tipGlow.fade
      dispMat.uniforms.uTip.value.set(glowLook('load').length * cssW, tipAmount < 0.002 ? 0 : tipAmount)

      // Visuals bounce: eases in when Visuals is selected, out again after `seconds`.
      const bounceTarget = S.bounce.enabled && performance.now() < bounceUntil.current && !still ? 1 : 0
      // `fade` is per frame at 60 fps; scaled by the real frame time so slow frames keep the same pace.
      const bounceDt = Math.min(0.25, Math.max(0, seconds - bounceSeconds))
      bounceSeconds = seconds
      bounceAmount += (bounceTarget - bounceAmount) * (1 - Math.pow(1 - S.bounce.fade, bounceDt * 60))
      dispMat.uniforms.uBounce.value.x = bounceAmount < 0.002 ? 0 : bounceAmount

      // Contact traces: a new set each time Contact opens (and after a resize, since they
      // sit on the grid); they travel on their own, and fade with the page.
      const tracing = S.trace.enabled && traceOn.current && !still
      if (tracing && (!traces.on || traces.w !== cssW || traces.h !== cssH)) newTraces(traces.on ? traces.at : seconds)
      traces.on = tracing
      traces.amount += ((tracing ? 1 : 0) - traces.amount) * (1 - Math.pow(1 - S.trace.fade, bounceDt * 60))
      if (!tracing && traces.amount < 0.002) {
        traces.amount = 0
        traces.list = null
      }
      const traceLen = dispMat.uniforms.uTraceLen.value
      for (let n = 0; n < MAX_TRACES; n++) {
        const t = traces.list?.[n]
        traceLen[n] = t ? Math.max(0, seconds - traces.at - t.delay) * S.trace.speed * cssH : 0
      }
      dispMat.uniforms.uTraceLook.value.x = traces.amount
      dispMat.uniforms.uTraceLook.value.y = Math.max(1, glowLook('contact').length * cssH)

      // Visuals pour: a new spot each click, with puffs heading off around a random
      // direction. Each steers by its own turn rate plus a wobble, drifts up a little,
      // and grows and thins over its life. Stepped in small pieces of real time, so
      // the shape is the same whatever the frame rate.
      const dt = lastFrame < 0 ? 1 / 60 : Math.min(0.25, seconds - lastFrame)
      lastFrame = seconds
      const subSteps = Math.max(1, Math.ceil(dt * 60))
      if (pourAt.current >= 0 && pourAt.current !== pour.at) {
        pour.at = pourAt.current
        const [ax0, ax1, ay0, ay1] = POUR.area
        const x = ax0 + Math.random() * (ax1 - ax0)
        const y = ay0 + Math.random() * (ay1 - ay0)
        const base = Math.random() * Math.PI * 2
        pour.puffs = Array.from({ length: Math.min(MAX_PUFFS, POUR.puffs) }, () => ({
          x, y,
          heading: base + (Math.random() - 0.5) * POUR.fan,
          turn: (Math.random() - 0.5) * 2 * POUR.curl,
          wobble: Math.random() * 10,
          speed: POUR.speed * (0.4 + Math.random() * 0.9),
          life: POUR.seconds * (0.6 + Math.random() * 0.4),
          radius: POUR.radius * (0.6 + Math.random() * 0.7),
        }))
      }
      const aspect = cssW / cssH
      const age = pour.at >= 0 ? (performance.now() - pour.at) / 1000 : Infinity
      for (let i = 0; i < MAX_PUFFS; i++) {
        const p = pour.puffs[i]
        const u = smokeMat.uniforms.uPuffs.value[i]
        if (!INK.enabled || !p || age >= p.life) { u.w = 0; continue }
        const span = Math.min(dt, age) // a puff born mid-frame only moves for the part it was alive
        const h = span / subSteps
        for (let n = 0; n < subSteps; n++) {
          const ta = age - span + (n + 1) * h
          const kk = ta / p.life
          p.heading += (p.turn + Math.sin(ta * 3.1 + p.wobble) * POUR.curl * 0.6) * h
          const v = p.speed * (1 - 0.5 * kk) // slows as it spreads
          p.x += Math.cos(p.heading) * v * h
          p.y += (Math.sin(p.heading) * v + POUR.rise * p.speed * kk) * h * aspect // uv y spans the height
        }
        const k = age / p.life
        // Swells in quickly, grows as it goes, and eases off toward the end.
        u.set(clamp01(p.x), clamp01(p.y), p.radius * (1 + (POUR.grow - 1) * k), POUR.strength * Math.min(1, k * 6) * Math.pow(1 - k, 0.5))
      }

      // Simulation
      if (INK.enabled) {
        simMat.uniforms.uDt.value = 1 / 60
        // Scale the rate with the simulation width so `speed` means the same thing at any resolution.
        simMat.uniforms.uRate.value = 6 * INK.speed * (rtA.width / 480)
        quad.material = simMat
        for (let i = 0; i < SIM_STEPS; i++) {
          simMat.uniforms.uTime.value = seconds
          simMat.uniforms.uPrev.value = rtA.texture
          renderer.setRenderTarget(rtB)
          renderer.render(scene, camera)
          ;[rtA, rtB] = [rtB, rtA]
        }
      }

      // Smoke: runs while there is a pour and until it has faded (then it just holds an empty layer).
      if (INK.enabled && age < POUR.seconds + POUR.fade * 6) {
        smokeMat.uniforms.uTime.value = seconds
        smokeMat.uniforms.uDt.value = Math.max(1 / 240, dt)
        quad.material = smokeMat
        smokeMat.uniforms.uPrev.value = smA.texture
        renderer.setRenderTarget(smB)
        renderer.render(scene, camera)
        ;[smA, smB] = [smB, smA]
      }

      // Display
      dispMat.uniforms.uInk.value = rtA.texture
      dispMat.uniforms.uSmoke.value = smA.texture
      quad.material = dispMat
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)

      el.dataset.seconds = seconds.toFixed(1)
      el.dataset.scroll = scrollSmooth.toFixed(2)
      el.dataset.locked = lock.active ? '1' : '0'
    }

    resize()
    let raf = 0
    if (still) {
      for (let i = 0; i < 400; i++) step(i / 60) // one finished stain, no motion
    } else {
      const loop = () => {
        step(clock())
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(el)
    const panelEl = el.closest('.section')?.querySelector('.header.margin-bottom_none')
    const mo = panelEl ? new MutationObserver(() => resize()) : null
    if (panelEl) mo.observe(panelEl, { childList: true, subtree: true, characterData: true })
    document.fonts?.ready.then(() => resize())

    return () => {
      cancelAnimationFrame(raf)
      lock.active = false
      window.removeEventListener('wheel', stopScroll)
      window.removeEventListener('touchmove', stopScroll)
      window.removeEventListener('keydown', stopKeys)
      window.removeEventListener('scroll', holdPosition)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onVirtualKey)
      paintHost.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      ro.disconnect()
      mo?.disconnect()
      rtA?.dispose()
      rtB?.dispose()
      smA?.dispose()
      smB?.dispose()
      smokeMat.dispose()
      simMat.dispose()
      dispMat.dispose()
      quad.geometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={host} className={`sketch_backdrop ${className}`} aria-hidden="true" />
}
