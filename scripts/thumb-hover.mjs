#!/usr/bin/env node
// Cuts the clip a project's tile plays while the mouse is over it (thumb-hover.mp4,
// picked up by src/data/media.js thumbFor) from a video in the project's folder.
//   node scripts/thumb-hover.mjs <slug> <video> <start-seconds> [seconds]
//   node scripts/thumb-hover.mjs intel-the-light-keeper 01.mp4 12        -> 5 s from 12 s in
// The clip is silent, 720 px on its longest side, H.264. Run `npm run media` after
// (it also runs before dev and build) to make the web copy.
// Needs ffmpeg on the PATH (brew install ffmpeg).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [slug, video, start = '0', seconds = '5'] = process.argv.slice(2)
if (!slug || !video) {
  console.error('usage: node scripts/thumb-hover.mjs <slug> <video> <start-seconds> [seconds]')
  process.exit(1)
}
const dir = path.join(ROOT, 'src/assets/projects', slug)
const src = path.join(dir, video)
if (!existsSync(src)) {
  console.error(`no ${video} in ${dir}`)
  process.exit(1)
}
const out = path.join(dir, 'thumb-hover.mp4')
const scale = "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))'"
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(seconds), '-i', src, '-vf', `${scale},fps=30`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out], { stdio: 'inherit' })
console.log(`${slug}/thumb-hover.mp4: ${seconds} s from ${start} s of ${video}`)
