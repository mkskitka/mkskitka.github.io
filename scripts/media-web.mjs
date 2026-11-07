#!/usr/bin/env node
// Makes web-sized copies of the project media.
//
//   src/assets/projects/<slug>/*   (your originals: drop files in, any size)
//   src/assets/web/<slug>/*        (what the site ships; made by this script)
//
// The site reads src/assets/web (src/data/media.js), never the originals, so nothing
// here changes how you add a project: drop files into src/assets/projects/<slug>/ and
// run `npm run media` (it also runs by itself before `npm run dev` / `npm run build`).
// Only files whose original is newer than the copy are redone, so a run is quick.
//
//   images   -> .webp, no wider / taller than MAX_IMAGE px (thumb.* -> MAX_THUMB px);
//               gifs are copied as they are, so they keep animating
//   videos   -> .mp4, H.264, no wider / taller than MAX_VIDEO px, at most 30 fps, with
//               no sound (the site plays every video muted, so the audio track is dropped),
//               plus a <name>-poster.webp frame the gallery shows before it plays;
//               a video already small enough (see KEEP_VIDEO) keeps its picture as it is
//   skipped  -> *.source.*, .MOV / .HEIC (browsers can't play them; convert first)
//
// Needs ffmpeg + ffprobe on the PATH (brew install ffmpeg) and sharp (npm).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, unlinkSync, utimesSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SRC = join(ROOT, 'src/assets/projects')
const OUT = join(ROOT, 'src/assets/web')

const MAX_IMAGE = 2000 // px, longest side, for gallery / showcase / hero images
const MAX_THUMB = 1024 // px, longest side, for thumb.* (the Systems tiles are 6 cells, ~450 px, so ~900 px on a retina screen)
const WEBP_QUALITY = 82
const MAX_VIDEO = 1280 // px, longest side
const MAX_FPS = 30
const CRF = 26 // H.264 quality: lower = better and bigger (23 is "visually lossless", 28 visibly soft)
// A video is copied untouched when it is already within size, fps, and this bitrate.
const KEEP_VIDEO = { bitrate: 2_000_000 }

const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i
const VIDEO = /\.(mp4|webm)$/i
const SKIP = /\.source\.|\.(mov|heic)$/i

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`
const fresh = (src, out) => existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs
const stem = (name) => name.replace(/\.[^.]+$/, '')
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()

const probe = (file) => {
  const out = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=bit_rate,duration', '-of', 'json', file])
  const j = JSON.parse(out)
  const s = j.streams?.[0] ?? {}
  const [n, d] = String(s.r_frame_rate ?? '30/1').split('/').map(Number)
  const audio = run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]).trim() !== ''
  return { width: s.width ?? 0, height: s.height ?? 0, fps: d ? n / d : n, bitrate: Number(j.format?.bit_rate ?? 0), duration: Number(j.format?.duration ?? 0), audio }
}

async function image(src, out, max) {
  const isGif = /\.gif$/i.test(src)
  if (isGif) {
    copyFileSync(src, out)
    return
  }
  await sharp(src, { animated: false })
    .rotate() // honour the EXIF orientation from phone cameras
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(out)
}

function video(src, out) {
  const p = probe(src)
  const small = Math.max(p.width, p.height) <= MAX_VIDEO && p.fps <= MAX_FPS + 0.01 && p.bitrate <= KEEP_VIDEO.bitrate && /\.mp4$/i.test(src)
  if (small || /\.webm$/i.test(src)) {
    if (!p.audio) {
      copyFileSync(src, out)
      return { how: 'copied', duration: p.duration }
    }
    // Picture untouched, sound dropped.
    run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-c:v', 'copy', '-an', '-movflags', '+faststart', out])
    return { how: 'copied, no sound', duration: p.duration }
  }
  const scale = `scale='if(gt(iw,ih),min(${MAX_VIDEO},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_VIDEO},ih))'`
  const filters = [scale]
  if (p.fps > MAX_FPS + 0.01) filters.push(`fps=${MAX_FPS}`)
  const args = ['-v', 'error', '-y', '-i', src, '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  args.push('-an', out) // no sound: the site plays every video muted
  run('ffmpeg', args)
  return { how: 'encoded', duration: p.duration }
}

async function poster(videoFile, out, duration) {
  const tmp = `${out}.png`
  // A frame one second in (past any fade-in), or halfway for a clip shorter than that.
  const at = duration > 0 ? Math.min(1, duration / 2) : 0
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', videoFile, '-frames:v', '1', tmp])
  await sharp(tmp).resize({ width: MAX_VIDEO, height: MAX_VIDEO, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(out)
  unlinkSync(tmp)
}

async function main() {
  if (!existsSync(SRC)) {
    console.log(`media-web: no ${SRC}; nothing to do`)
    return
  }
  mkdirSync(OUT, { recursive: true })
  let before = 0
  let after = 0
  const wanted = new Set() // every output file that should exist, to clear out stale ones
  for (const slug of readdirSync(SRC)) {
    const dir = join(SRC, slug)
    if (!statSync(dir).isDirectory()) continue
    const outDir = join(OUT, slug)
    mkdirSync(outDir, { recursive: true })
    for (const name of readdirSync(dir)) {
      const src = join(dir, name)
      if (SKIP.test(name) || !(IMAGE.test(name) || VIDEO.test(name))) continue
      const isVideo = VIDEO.test(name)
      const outName = isVideo ? `${stem(name)}${/\.webm$/i.test(name) ? '.webm' : '.mp4'}` : /\.gif$/i.test(name) ? name : `${stem(name)}.webp`
      const out = join(outDir, outName)
      if (wanted.has(out)) {
        console.warn(`${slug}/${name}: skipped, another file in the folder already makes ${outName} (same name, different extension)`)
        continue
      }
      wanted.add(out)
      // thumb-hover.* (a tile's hover clip, made on purpose by scripts/thumb-hover.mjs or by
      // hand, maybe with an alpha channel): shipped exactly as it is, and no poster.
      const asIs = isVideo && /^thumb-hover\./i.test(name)
      const posterOut = isVideo && !asIs ? join(outDir, `${stem(name)}-poster.webp`) : null
      if (posterOut) wanted.add(posterOut)
      before += statSync(src).size
      if (fresh(src, out) && (!posterOut || fresh(src, posterOut))) {
        after += statSync(out).size
        continue
      }
      process.stdout.write(`${slug}/${name} ... `)
      try {
        let how = 'webp'
        if (asIs) {
          copyFileSync(src, out)
          how = 'copied as is'
        } else if (isVideo) {
          const v = video(src, out)
          how = v.how
          await poster(src, posterOut, v.duration)
        } else {
          await image(src, out, /^thumb\./i.test(name) ? MAX_THUMB : MAX_IMAGE)
        }
        // Stamp the copy with the original's time plus a moment, so "fresh" holds even
        // when a video copy is bit-identical (copyFileSync keeps the destination's clock).
        const t = new Date(statSync(src).mtimeMs + 1000)
        utimesSync(out, t, t)
        if (posterOut) utimesSync(posterOut, t, t)
        const size = statSync(out).size
        after += size
        console.log(`${how}, ${kb(statSync(src).size)} -> ${kb(size)}`)
      } catch (err) {
        console.log('FAILED')
        console.error(String(err.stderr ?? err.message ?? err))
        process.exitCode = 1
      }
    }
  }
  // Copies whose original has gone.
  for (const slug of readdirSync(OUT)) {
    const dir = join(OUT, slug)
    if (!statSync(dir).isDirectory()) continue
    if (!existsSync(join(SRC, slug))) {
      rmSync(dir, { recursive: true })
      console.log(`removed ${slug}/ (no such project folder any more)`)
      continue
    }
    for (const name of readdirSync(dir)) {
      const f = join(dir, name)
      if (!wanted.has(f)) {
        unlinkSync(f)
        console.log(`removed ${slug}/${name} (original gone)`)
      }
    }
  }
  console.log(`media-web: originals ${kb(before)} -> web copies ${kb(after)} in ${OUT.replace(ROOT + '/', '')}`)
}

main()
