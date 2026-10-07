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
const SETTINGS = {
  background: [12, 12, 14],
  spacing: 0.06, // gap between lines, as a fraction of the shorter page side (only when rowsFromText is 0)
  minSpacing: 22, // px
  maxSpacing: 80, // px
  rowsFromText: 1.2, // row height = hero menu text size x this, so one line of text fits a row, on every screen size
  //                    (0 = use `spacing`). Phones get a smaller text size (--hero-menu-size in custom.css), so a larger
  //                    grid than `spacing` would give, with the menu text and its glass panel on the lines.
  weight: 1.1, // line thickness in px
  scrollSmoothing: 0.1, // how smoothly the lines follow the scroll: 0.05 very floaty, 0.1 smooth, 1 instant (jumps with each wheel click)

  horizontal: {
    colors: { from: [235, 70, 55], to: [45, 215, 205] }, // red -> teal
    start: 0,
    initialLength: 0.2,
    finalLength: 1,
    growth: 'time',
    seconds: 8,
    finishWithLock: true,
    scrollRange: 1,
    ease: 'out',
  },

  vertical: {
    colors: { from: [50, 90, 235], to: [240, 75, 130] }, // blue -> pink
    start: 0,
    initialLength: 0,
    finalLength: 1,
    growth: 'scroll',
    seconds: 3,
    scrollRange: 0.65, // reach the bottom at 65% of the hero's pinned scroll; the remaining 35% is a pause
    //                   with the finished grid before the next section arrives (hero pin length: data-hold in Home.jsx)
    ease: 'linear',
  },

  scroll: {
    mode: 'virtual', // 'virtual': wheel/touch/keys drive the animation, page stays put | 'page': real scrolling
    range: 1.5, // virtual: screens' worth of wheel/touch input from start to finish
    keyStep: 0.08, // virtual: how far one arrow-key press moves (fraction of the range)
  },

  scrollLock: {
    enabled: false, // optional: hold the page still for `seconds` at the first scroll (off: scrolling drives everything)
    seconds: 3,
    scrollStart: 0.02, // how far into the hero (0..1) the first scroll has to go to count as "the first scroll"
  },

  ink: {
    enabled: true,
    trigger: 'scroll', // 'scroll': the first scroll starts the drops, then they keep landing on their own
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
    density: 1, // how opaque the thickest part gets (0..1)
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
      strength: 1, // how hard it pours while held (0.5 gentle, 1 full pressure)
    },

    dams: true, // grid lines hold the ink back until it builds up pressure (see header)
    lineThreshold: .8, // pressure needed at a line before ink spills across (0.1 leaky, 0.6 very tight)
    lineLoss: 0.06, // pressure lost crossing a line (higher = fewer cells reached)
  },

  // Phones: screens narrower than `maxWidth` use these ink values instead of the ones
  // above (same meanings). A phone page is small and tall, so the desktop amounts read
  // as a few specks; more drops that soak further fill it like the desktop does.
  phone: {
    maxWidth: 767,
    ink: {
      drops: 12,
      interval: 0.9,
      dropRadius: 0.03,
      pour: 3,
      spread: 3,
      lineThreshold: 0.6,
      lineLoss: 0.04,
    },
  },
}

const PANEL_PAD_ROWS = 1 // rows of glass above and below the hero menu text (whole rows keep the panel on grid lines)
const PANEL_PAD_COLS = 0.5 // columns of glass left of the text (the right edge snaps to the next grid line)

const MAX_DROPS = 16
const SIM_SCALE = .1 // simulation resolution relative to the page (lower = cheaper, blockier edges)
const SIM_STEPS = 2 // simulation steps per frame

const EASES = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
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
  uniform float uSpacing;    // css px
  uniform vec2 uHx, uVy;     // horizontal x0,x1 and vertical y0,y1 in css px (y down)
  uniform float uDams, uLineThreshold, uLineLoss, uDiffuse;
  ${NOISE_GLSL}

  vec2 toPx(vec2 uv) { return vec2(uv.x, 1.0 - uv.y) * uSize; }
  // Does the step from a to b (css px) cross a grid line that exists there?
  bool crossesLine(vec2 a, vec2 b) {
    float s = uSpacing;
    // horizontal lines (y = s/2 + k s) exist for x in [x0, x1]
    if (floor((a.y - 0.5 * s) / s) != floor((b.y - 0.5 * s) / s)) {
      float x = 0.5 * (a.x + b.x);
      if (x >= uHx.x && x <= uHx.y) return true;
    }
    // vertical lines (x = s/2 + k s) exist for y in [y0, y1]
    if (floor((a.x - 0.5 * s) / s) != floor((b.x - 0.5 * s) / s)) {
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

// --- Display: background, then ink tinted by the grid colours, then the lines on top.
const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uInk;
  uniform vec2 uSize;        // css px
  uniform float uTime;
  uniform vec3 uBg;
  uniform float uSpacing, uWeight;
  uniform vec2 uHx, uVy;     // horizontal x0,x1 and vertical y0,y1 in css px (y down)
  uniform vec3 uHFrom, uHTo, uVFrom, uVTo;
  uniform float uInkOn, uRim, uShimmer, uDensity, uSoft, uCloud, uWisps, uDrift;
  ${NOISE_GLSL}
  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize; // css px, y down
    vec3 col = uBg;

    // Grid colour at this point (used by the ink and the lines).
    float hx = clamp((px.x - uHx.x) / max(1.0, uHx.y - uHx.x), 0.0, 1.0);
    float vy = clamp((px.y - uVy.x) / max(1.0, uVy.y - uVy.x), 0.0, 1.0);
    vec3 hCol = mix(uHFrom, uHTo, hx);
    vec3 vCol = mix(uVFrom, uVTo, vy);

    if (uInkOn > 0.5) {
      vec2 asp = vec2(uSize.x / uSize.y, 1.0);
      vec2 q = vUv * asp;
      float t = uTime * uDrift;
      // Two layers of slow turbulence: large swirls carrying finer curls, like smoke.
      vec2 w1 = vec2(fbm(q * 2.0 + t * 0.07), fbm(q * 2.0 + 5.0 - t * 0.05)) - 0.5;
      vec2 w2 = vec2(fbm(q * 6.0 - t * 0.11 + w1), fbm(q * 6.0 + 9.0 + t * 0.09 + w1)) - 0.5;
      vec2 warp = (w1 * 0.02 + w2 * 0.008) * uShimmer;
      float w = texture2D(uInk, vUv + warp / asp).r;

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
      float a = dens * uDensity;
      col = 1.0 - (1.0 - col) * (1.0 - min(inkCol, vec3(1.0)) * a);
    }

    // Lines. Lines sit at spacing/2 + k*spacing on each axis.
    float aa = 0.7;
    float fh = fract(px.y / uSpacing + 0.5);
    float dh = min(fh, 1.0 - fh) * uSpacing;
    float hLine = (1.0 - smoothstep(uWeight * 0.5 - aa, uWeight * 0.5 + aa, dh)) * step(uHx.x, px.x) * step(px.x, uHx.y);
    float fv = fract(px.x / uSpacing + 0.5);
    float dv = min(fv, 1.0 - fv) * uSpacing;
    float vLine = (1.0 - smoothstep(uWeight * 0.5 - aa, uWeight * 0.5 + aa, dv)) * step(uVy.x, px.y) * step(px.y, uVy.y);
    col = mix(col, hCol, hLine);
    col = mix(col, vCol, vLine);
    gl_FragColor = vec4(col, 1.0);
  }
`

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export default function GridInkBackdrop({ className = '' }) {
  const host = useRef(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const S = SETTINGS
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const phone = window.matchMedia(`(max-width: ${S.phone.maxWidth}px)`).matches
    const INK = phone ? { ...S.ink, ...S.phone.ink } : S.ink

    // Remove any canvas a previous mount left behind (React StrictMode mounts twice).
    el.querySelectorAll('canvas').forEach((c) => c.remove())

    // If WebGL is unavailable (very old browser, blocked GPU), leave the plain dark
    // ground rather than taking the page down.
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
    } catch (err) {
      console.warn('GridInkBackdrop: WebGL unavailable, showing a plain backdrop.', err)
      return undefined
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
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
        uSpacing: { value: 30 },
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
        uSpacing: { value: 30 },
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
      },
    })
    const gridMats = [simMat, dispMat]

    let rtA = null
    let rtB = null
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
      renderer.setRenderTarget(rtA)
      renderer.clear()
      renderer.setRenderTarget(rtB)
      renderer.clear()
      renderer.setRenderTarget(null)
    }

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
      gridMats.forEach((m) => {
        m.uniforms.uSize.value.set(cssW, cssH)
        m.uniforms.uSpacing.value = spacing
      })
      // Tell the CSS about the grid so the hero menu panel can sit on it: the text
      // takes one row per line, and the glass panel's edges land on grid lines with
      // PANEL_PAD_ROWS rows of glass above/below the text and PANEL_PAD_COLS columns
      // either side. Lines sit at spacing/2 + k*spacing on both axes.
      const section = el.closest('.section')
      if (section) {
        const L = (k) => spacing / 2 + k * spacing
        const padTop = parseFloat(getComputedStyle(section).paddingTop) || 0
        const panel = section.querySelector('.header.margin-bottom_none')
        section.style.setProperty('--grid-spacing', `${spacing}px`)
        if (panel) {
          const top = L(Math.floor((padTop - spacing / 2) / spacing)) // line at or just above the section padding
          const left = L(Math.max(0, Math.round((20 - spacing / 2) / spacing))) // line nearest the 20px margin
          // Natural text width, independent of the panel's current width.
          let textW = 0
          panel.querySelectorAll('a').forEach((a) => {
            const r = document.createRange()
            r.selectNodeContents(a)
            textW = Math.max(textW, r.getBoundingClientRect().width)
          })
          const padX = spacing * PANEL_PAD_COLS
          const right = L(Math.ceil((left + padX + textW + padX - spacing / 2) / spacing)) // next line past the text
          section.style.setProperty('--hero-panel-top', `${(top - padTop).toFixed(2)}px`)
          section.style.setProperty('--hero-panel-left', `${left.toFixed(2)}px`)
          section.style.setProperty('--hero-panel-width', `${(right - left).toFixed(2)}px`)
          section.style.setProperty('--hero-panel-pad-x', `${padX.toFixed(2)}px`)
          section.style.setProperty('--hero-panel-pad-y', `${(spacing * PANEL_PAD_ROWS).toFixed(2)}px`)
        }
      }
      makeTargets()
      // Drops that already landed re-land so the stain rebuilds at the new size.
      for (const d of landed) d.time = clock() - 0.001
    }

    // Virtual scroll: accumulate wheel / touch / key input into px, without the page moving.
    let virtualPx = 0
    const virtualRange = () => Math.max(1, window.innerHeight * S.scroll.range)
    const bump = (dy) => { virtualPx = Math.min(virtualRange(), Math.max(0, virtualPx + dy)) }
    const onWheel = (e) => { if (S.scroll.mode === 'virtual') { e.preventDefault(); bump(e.deltaY) } }
    let touchY = null
    const onTouchStart = (e) => { touchY = e.touches[0]?.clientY ?? null }
    const onTouchMove = (e) => {
      if (S.scroll.mode !== 'virtual' || touchY === null) return
      const y = e.touches[0]?.clientY ?? touchY
      bump((touchY - y) * 1.5)
      touchY = y
      e.preventDefault()
    }
    const keyDelta = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4, ' ': 4, End: 100, Home: -100 }
    const onVirtualKey = (e) => {
      if (S.scroll.mode !== 'virtual' || !(e.key in keyDelta) || e.target.closest('input, textarea')) return
      e.preventDefault()
      bump(keyDelta[e.key] * S.scroll.keyStep * virtualRange())
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onVirtualKey)

    // 0 at the start, 1 when the hero's scroll (virtual or pinned) is used up.
    const scrollProgress = () => {
      if (S.scroll.mode === 'virtual') return clamp01(virtualPx / virtualRange())
      const section = el.closest('.section')
      const spacer = section?.parentElement
      let dist = (spacer?.offsetHeight || 0) - (section?.offsetHeight || 0)
      if (dist < 10) dist = window.innerHeight
      return clamp01(window.scrollY / dist)
    }

    const t0 = performance.now()
    const clock = () => (performance.now() - t0) / 1000
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

    const step = (seconds) => {
      // Lines
      const target = still ? 1 : scrollProgress()
      scrollRaw = target
      scrollSmooth += (target - scrollSmooth) * (still ? 1 : S.scrollSmoothing)
      // First scroll: start the line animation and (optionally) hold the page.
      if (!still && lockStart < 0 && target >= S.scrollLock.scrollStart) {
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
          const start = still || INK.trigger === 'time' || (INK.trigger === 'scroll' && (lockStart >= 0 || target >= INK.scrollStart))
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

      // Display
      dispMat.uniforms.uInk.value = rtA.texture
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
      rtA?.dispose()
      rtB?.dispose()
      simMat.dispose()
      dispMat.dispose()
      quad.geometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={host} className={`sketch_backdrop ${className}`} aria-hidden="true" />
}
