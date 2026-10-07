import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* ============================================================================
   GRID + INK BACKDROP (three.js, GPU) — after the "gem vertahorizlines" piece.

   LINES: thin gradient lines on a near-black ground. Each set has:
     start          where the lines begin, as a fraction of the page
                    (horizontal: 0 = left edge; vertical: 0 = top edge)
     initialLength  how long they are on page load (fraction of the page)
     finalLength    how long they grow to; 1 = all the way to the far edge
     growth         'time' (grow after load) | 'scroll' (grow with the hero scroll) | 'none'
     seconds        time mode: how long the growth takes
     scrollRange    scroll mode: how much of the hero scroll completes the growth
     ease           'linear' | 'out' | 'inOut'
     colors         gradient along the line, start end -> far end

   INK: a liquid simulation. As you scroll, drops land and soak outward through
   "paper" like water spreading on cloth: fast at first, then slowing to a stop,
   with a soft, rounded, slightly denser front. Drops that meet merge into one
   stain. The grid colours the ink: at any point the ink is the average of the
   horizontal-line colour at that x and the vertical-line colour at that y, so one
   stain shifts hue across the page.

   STRUCTURED mode (ink.structured): the grid also shapes how the ink moves.
   - Closed squares (lines on all four sides) fill one square at a time, as blocks.
   - Open rows (bounded only above and below) and open columns (bounded only left
     and right) fill straight across their short side wherever the ink has reached,
     and creep along their length only as far as the liquid actually travels, like
     water running down a channel.
   - Where there are no lines at all the ink stays free liquid.
   Turn it off for the free liquid everywhere.
   ============================================================================ */
const SETTINGS = {
  background: [12, 12, 14],
  spacing: 0.06, // gap between lines, as a fraction of the shorter page side
  minSpacing: 22, // px
  maxSpacing: 80, // px
  weight: 1.1, // line thickness in px
  scrollSmoothing: 0.08, // how quickly scroll-driven things catch up (0.01 lazy … 1 instant)

  horizontal: {
    colors: { from: [235, 70, 55], to: [45, 215, 205] }, // red -> teal
    start: 0,
    initialLength: 0.2,
    finalLength: 1,
    growth: 'time',
    seconds: 14,
    scrollRange: 1,
    ease: 'out',
  },

  vertical: {
    colors: { from: [50, 90, 235], to: [240, 75, 130] }, // blue -> pink
    start: 0,
    initialLength: 0.3,
    finalLength: 1,
    growth: 'scroll',
    seconds: 10,
    scrollRange: 1,
    ease: 'linear',
  },

  ink: {
    enabled: true,
    trigger: 'scroll', // 'scroll': drops land as you scroll | 'time': one every `interval` seconds | 'none'
    drops: 7, // how many drops land in total (max 16)
    scrollStart: 0.03, // scroll mode: progress at which the first drop lands
    scrollRange: 0.85, // scroll mode: progress by which the last drop has landed
    interval: 1.5, // time mode: seconds between drops
    area: 'grid', // 'grid': drops land inside the part of the page the grid has reached | 'page': anywhere
    structured: true, // grid shapes the ink: squares fill block by block, open rows/columns fill as bars (see header)
    squareFill: 0.78, // pressure kept when a square fills (lower = the ink runs out after fewer squares; 0.78 ≈ 8-10 squares)
    barFill: 0.85, // pressure kept when a row/column fills across its short side (the ink still has to travel along it)
    blockSpeed: 0.12, // how fast ink creeps from one square/bar to the next, relative to free liquid (0.12 ≈ a step per second)
    fillSoftness: 0.08, // how gradually a square or bar fades in (bigger = gentler)
    dropRadius: 0.012, // size of the puddle a drop makes on landing, as a fraction of the page width
    pour: 0.8, // seconds a drop keeps feeding ink after it lands
    spread: 1, // how far each drop soaks outward (1 ≈ a quarter of the page width)
    speed: 2, // how fast it soaks (1 slow and viscous, 4 quick)
    fibers: 0.45, // paper texture: 0 perfectly round blot, 1 gently uneven edge, 2 ragged
    fiberScale: 9, // size of the fibre pattern (higher = finer; low keeps the edge smooth)
    rim: 0.5, // brighter, more saturated ring at the wet front (0 = none)
    shimmer: 0.5, // slow liquid wobble of the edges (0 = still)
    opacity: 0.82,
    seed: 7, // change for different drop positions / paper
  },
}

const MAX_DROPS = 16
const SIM_SCALE = 0.5 // simulation resolution relative to the page (lower = cheaper, blockier edges)
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

// Grid structure shared by the passes: which region a pixel is in and where its
// square / bar lives. uWet is the current wetness texture (the previous sim frame
// in the sim pass, the finished frame in the display pass).
const STRUCT_GLSL = /* glsl */ `
  uniform vec2 uSize;
  uniform float uSpacing;
  uniform vec2 uHx, uVy;
  uniform sampler2D uWet;
  uniform float uStructured;
  // region: 0 empty, 1 closed square, 2 open row, 3 open column
  void classify(vec2 px, out int region, out float ci, out float cj, out vec2 center) {
    float s = uSpacing;
    ci = floor((px.x - s * 0.5) / s);
    cj = floor((px.y - s * 0.5) / s);
    float l = max(0.0, s * 0.5 + ci * s), r = s * 0.5 + (ci + 1.0) * s;
    float t = max(0.0, s * 0.5 + cj * s), b = s * 0.5 + (cj + 1.0) * s;
    center = vec2((l + r) * 0.5, (t + b) * 0.5);
    bool hBound = (l >= uHx.x - 0.5) && (r <= uHx.y + 0.5); // lines above and below
    bool vBound = (t >= uVy.x - 0.5) && (b <= uVy.y + 0.5); // lines left and right
    region = (hBound && vBound) ? 1 : (hBound ? 2 : (vBound ? 3 : 0));
  }
  vec2 simUv(vec2 px) { return vec2(px.x / uSize.x, 1.0 - px.y / uSize.y); }
  // Wettest point straight across an open row at this x (from the line above it
  // to the line below), or across an open column at this y. The bar fills its
  // short side here only when the ink has actually arrived at this spot.
  float rowCross(float x, float cj) {
    float s = uSpacing;
    float t = max(0.0, s * 0.5 + cj * s), b = min(uSize.y, s * 0.5 + (cj + 1.0) * s);
    float m = 0.0;
    for (int k = 0; k < 12; k++) m = max(m, texture2D(uWet, simUv(vec2(x, mix(t, b, (float(k) + 0.5) / 12.0)))).r);
    return m;
  }
  float colCross(float y, float ci) {
    float s = uSpacing;
    float l = max(0.0, s * 0.5 + ci * s), r = min(uSize.x, s * 0.5 + (ci + 1.0) * s);
    float m = 0.0;
    for (int k = 0; k < 12; k++) m = max(m, texture2D(uWet, simUv(vec2(mix(l, r, (float(k) + 0.5) / 12.0), y))).r);
    return m;
  }
`

// --- Simulation: R = wetness/pressure. Spreads from wet neighbours, losing pressure
// with distance (more through dense fibres), soaking faster where pressure is high.
const SIM_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uTexel;      // 1 / sim size
  uniform float uAspect;    // width / height
  uniform float uLoss;      // pressure lost per texel at perm = 1
  uniform float uRate;      // soak rate per second
  uniform float uDt;
  uniform float uFibers;
  uniform float uFiberScale;
  uniform float uSeed;
  uniform float uTime;
  uniform float uDropRadius; // in uv units of width
  uniform float uPour;
  uniform vec4 uDrops[${MAX_DROPS}]; // x, y (uv), landTime, active
  uniform float uSquareFill, uBarFill, uFillThr, uBlockRate;
  ${NOISE_GLSL}
  ${STRUCT_GLSL}
  void main() {
    float w = texture2D(uPrev, vUv).r;
    // Broad, gentle variation in how easily the paper takes ink, so the edge
    // swells and dips slowly instead of fraying.
    vec2 fp = vUv * vec2(uAspect, 1.0) * uFiberScale + uSeed * 3.1;
    float n = fbm(fp);
    float perm = clamp(1.0 + uFibers * (n - 0.5) * 1.8, 0.4, 1.4);
    float loss = uLoss / perm;
    // Look in many directions on two rings, charging each sample its true
    // distance, so the front advances as a circle rather than the octagon an
    // 8-neighbour kernel produces.
    float mx = 0.0;
    for (int k = 0; k < 16; k++) {
      float a = float(k) * 0.39269908; // 2π / 16
      vec2 dir = vec2(cos(a), sin(a)) * uTexel;
      mx = max(mx, texture2D(uPrev, vUv + dir).r - loss);
      mx = max(mx, texture2D(uPrev, vUv + dir * 2.2).r - loss * 2.2);
    }
    float target = max(w, mx);
    int region = 0; float ci, cj; vec2 center;
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
    if (uStructured > 0.5) classify(px, region, ci, cj, center);
    // Soak toward the pressure of the wettest neighbour: quick near the source,
    // creeping at the edges, so the front decelerates like real absorption.
    // Inside the grid the creep between squares / bars is slower (uBlockRate).
    float rate = uRate * (region == 0 ? 1.0 : uBlockRate);
    float k = clamp(rate * uDt * perm * (0.15 + 0.85 * target * target), 0.0, 1.0);
    w += (target - w) * k;
    // Structured mode: a square fills as one block once its middle is wet; an open
    // row / column fills straight across its short side wherever the ink has got to.
    if (uStructured > 0.5) {
      if (region == 1) {
        float wc = texture2D(uPrev, simUv(center)).r;
        if (wc > uFillThr) w = max(w, wc * uSquareFill);
      } else if (region == 2) {
        float bm = rowCross(px.x, cj);
        if (bm > uFillThr) w = max(w, bm * uBarFill);
      } else if (region == 3) {
        float bm = colCross(px.y, ci);
        if (bm > uFillThr) w = max(w, bm * uBarFill);
      }
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
    gl_FragColor = vec4(w, 0.0, 0.0, 1.0);
  }
`

// --- Display: background, then ink tinted by the grid colours, then the lines on top.
const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uInk;
  uniform vec2 uInkTexel;    // 1 / sim size
  uniform float uTime;
  uniform vec3 uBg;
  uniform float uWeight;
  uniform vec3 uHFrom, uHTo, uVFrom, uVTo;
  uniform float uInkOn, uOpacity, uRim, uShimmer, uFillSoft;
  ${NOISE_GLSL}
  ${STRUCT_GLSL}
  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize; // css px, y down
    vec3 col = uBg;

    // Grid colour at this point (used by the ink and the lines).
    float hx = clamp((px.x - uHx.x) / max(1.0, uHx.y - uHx.x), 0.0, 1.0);
    float vy = clamp((px.y - uVy.x) / max(1.0, uVy.y - uVy.x), 0.0, 1.0);
    vec3 hCol = mix(uHFrom, uHTo, hx);
    vec3 vCol = mix(uVFrom, uVTo, vy);

    if (uInkOn > 0.5) {
      int region = 0; float ci, cj; vec2 center;
      if (uStructured > 0.5) classify(px, region, ci, cj, center);
      float w;
      float ink;
      if (region == 1) {
        w = texture2D(uInk, simUv(center)).r; // the whole square shows its middle value
        ink = smoothstep(0.03, 0.03 + uFillSoft, w);
      } else if (region == 2) {
        w = rowCross(px.x, cj);
        ink = smoothstep(0.03, 0.03 + uFillSoft, w);
      } else if (region == 3) {
        w = colCross(px.y, ci);
        ink = smoothstep(0.03, 0.03 + uFillSoft, w);
      } else {
        // Free liquid: slow domain warp so the edges undulate.
        vec2 q = vUv * 2.0;
        vec2 warp = (vec2(fbm(q + uTime * 0.05), fbm(q + 10.0 - uTime * 0.04)) - 0.5) * 0.012 * uShimmer;
        vec2 p = vUv + warp;
        // Soften the half-resolution simulation before thresholding it, so the
        // edge is a smooth meniscus rather than a stepped outline.
        vec2 t = uInkTexel * 1.5;
        w = texture2D(uInk, p).r * 0.4
          + (texture2D(uInk, p + vec2(t.x, 0.0)).r + texture2D(uInk, p - vec2(t.x, 0.0)).r
           + texture2D(uInk, p + vec2(0.0, t.y)).r + texture2D(uInk, p - vec2(0.0, t.y)).r) * 0.15;
        ink = smoothstep(0.0, 0.16, w);
      }
      float interior = smoothstep(0.12, 0.55, w);
      float grain = 0.86 + 0.14 * fbm(vUv * vec2(uSize.x / uSize.y, 1.0) * 70.0);
      vec3 inkCol = mix(hCol, vCol, 0.5) * grain;
      // Wet front: pigment gathers at the edge, so the rim is denser than the middle.
      float front = (1.0 - interior) * ink;
      inkCol = mix(inkCol * 0.72, inkCol * 0.92, interior);
      inkCol += inkCol * uRim * 0.5 * front;
      col = mix(col, min(inkCol, vec3(1.0)), ink * uOpacity);
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
        uFibers: { value: S.ink.fibers },
        uFiberScale: { value: S.ink.fiberScale },
        uSeed: { value: S.ink.seed },
        uTime: { value: 0 },
        uDropRadius: { value: S.ink.dropRadius },
        uPour: { value: S.ink.pour },
        uDrops: { value: drops },
        uSquareFill: { value: S.ink.squareFill },
        uBarFill: { value: S.ink.barFill },
        uFillThr: { value: 0.03 },
        uBlockRate: { value: S.ink.blockSpeed },
        // grid structure (shared)
        uSize: { value: new THREE.Vector2() },
        uSpacing: { value: 30 },
        uHx: { value: new THREE.Vector2() },
        uVy: { value: new THREE.Vector2() },
        uWet: { value: null },
        uStructured: { value: S.ink.structured ? 1 : 0 },
      },
    })
    const dispMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uInk: { value: null },
        uInkTexel: { value: new THREE.Vector2() },
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
        uInkOn: { value: S.ink.enabled ? 1 : 0 },
        uOpacity: { value: S.ink.opacity },
        uRim: { value: S.ink.rim },
        uShimmer: { value: still ? 0 : S.ink.shimmer },
        uFillSoft: { value: S.ink.fillSoftness },
        uWet: { value: null },
        uStructured: { value: S.ink.structured ? 1 : 0 },
      },
    })
    // Keep the grid-structure uniforms in sync across both passes.
    const gridMats = [simMat, dispMat]
    const setGrid = (name, fn) => gridMats.forEach((m) => fn(m.uniforms[name].value))

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
      dispMat.uniforms.uInkTexel.value.set(1 / sw, 1 / sh)
      simMat.uniforms.uAspect.value = sw / sh
      // spread 1 ≈ a quarter of the page width before the pressure runs out
      simMat.uniforms.uLoss.value = 1 / Math.max(1, 0.25 * S.ink.spread * sw)
      // clear both
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
      const spacing = Math.min(S.maxSpacing, Math.max(S.minSpacing, Math.min(cssW, cssH) * S.spacing))
      setGrid('uSize', (v) => v.set(cssW, cssH))
      gridMats.forEach((m) => (m.uniforms.uSpacing.value = spacing))
      makeTargets()
      // Drops that already landed re-land so the stain rebuilds at the new size.
      for (const d of landed) d.time = clock() - 0.001
    }

    // 0 at the top of the page, 1 when the hero's pinned scroll is used up.
    const scrollProgress = () => {
      const section = el.closest('.section')
      const spacer = section?.parentElement
      let dist = (spacer?.offsetHeight || 0) - (section?.offsetHeight || 0)
      if (dist < 10) dist = window.innerHeight
      return clamp01(window.scrollY / dist)
    }

    const t0 = performance.now()
    const clock = () => (performance.now() - t0) / 1000
    let scrollSmooth = 0
    const rng = mulberry32(S.ink.seed * 7919 + 13)
    const dropPlan = Array.from({ length: Math.min(MAX_DROPS, S.ink.drops) }, (_, i) => ({
      i,
      rx: 0.08 + rng() * 0.84,
      ry: 0.08 + rng() * 0.84,
      at: S.ink.scrollStart + (i * (S.ink.scrollRange - S.ink.scrollStart)) / Math.max(1, S.ink.drops - 1),
    }))
    const landed = []

    const progressFor = (cfg, seconds) => {
      if (still) return 1
      const ease = EASES[cfg.ease] || EASES.linear
      if (cfg.growth === 'time') return ease(clamp01(seconds / cfg.seconds))
      if (cfg.growth === 'scroll') return ease(clamp01(scrollSmooth / cfg.scrollRange))
      return 0
    }
    const extentFor = (cfg, size, progress) => {
      const length = cfg.initialLength + (cfg.finalLength - cfg.initialLength) * progress
      const a = cfg.start * size
      return [a, Math.min(size, a + length * size)]
    }

    const landDrop = (plan, x1, y1, now) => {
      const inGrid = S.ink.area === 'grid'
      const x = inGrid ? (plan.rx * x1) / cssW : plan.rx
      const y = inGrid ? (plan.ry * y1) / cssH : plan.ry
      const d = { plan, x, y: 1 - y, time: now } // sim uv has y up
      landed.push(d)
    }

    const step = (seconds) => {
      // Lines
      const target = still ? 1 : scrollProgress()
      scrollSmooth += (target - scrollSmooth) * (still ? 1 : S.scrollSmoothing)
      const [x0, x1] = extentFor(S.horizontal, cssW, progressFor(S.horizontal, seconds))
      const [y0, y1] = extentFor(S.vertical, cssH, progressFor(S.vertical, seconds))
      setGrid('uHx', (v) => v.set(x0, x1))
      setGrid('uVy', (v) => v.set(y0, y1))
      dispMat.uniforms.uTime.value = seconds

      // Drops
      if (S.ink.enabled && S.ink.trigger !== 'none') {
        for (const plan of dropPlan) {
          if (landed.some((d) => d.plan === plan)) continue
          const due = still || (S.ink.trigger === 'scroll' ? scrollSmooth >= plan.at : seconds >= plan.i * S.ink.interval)
          if (due) landDrop(plan, x1, y1, still ? 0 : seconds)
        }
        landed.forEach((d, n) => drops[n].set(d.x, d.y, d.time, 1))
        for (let n = landed.length; n < MAX_DROPS; n++) drops[n].w = 0
      }

      // Simulation
      if (S.ink.enabled) {
        const dt = 1 / 60
        simMat.uniforms.uDt.value = dt
        // Scale the rate with the simulation width so `speed` means the same thing at any resolution.
        simMat.uniforms.uRate.value = 6 * S.ink.speed * (rtA.width / 480)
        quad.material = simMat
        for (let i = 0; i < SIM_STEPS; i++) {
          simMat.uniforms.uTime.value = seconds
          simMat.uniforms.uPrev.value = rtA.texture
          simMat.uniforms.uWet.value = rtA.texture
          renderer.setRenderTarget(rtB)
          renderer.render(scene, camera)
          ;[rtA, rtB] = [rtB, rtA]
        }
      }

      // Display
      dispMat.uniforms.uInk.value = rtA.texture
      dispMat.uniforms.uWet.value = rtA.texture
      quad.material = dispMat
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)

      el.dataset.seconds = seconds.toFixed(1)
      el.dataset.scroll = scrollSmooth.toFixed(2)
    }

    resize()
    let raf = 0
    if (still) {
      // One finished stain, no motion.
      for (let i = 0; i < 400; i++) step(i / 60)
    } else {
      const loop = () => {
        step(clock())
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(el)

    return () => {
      cancelAnimationFrame(raf)
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
