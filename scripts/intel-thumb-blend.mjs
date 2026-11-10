// One-off: the Intel Light Keeper tile still (and, if wanted, its hover clip), part-way
// between the original frames and their Real-ESRGAN upscales (the still on its own
// looked a little blown out and cut-out). In src/assets/projects/intel-the-light-keeper/:
//   unused/thumb.source.png / used/05.mp4 (crop 270x267 at 468,102, first second)   the originals
//   unused/thumb.upscaled.source.png / unused/thumb-hover.upscaled.source.mp4      the upscales
//   used/thumb.png / used/thumb-hover.mp4                                          the blends (written here)
//   node scripts/intel-thumb-blend.mjs [upscaled share: 0 = original, 1 = upscale; default 0.5] [--clip]
// The clip is only written with --clip: it is kept as the plain upscale (thumb-hover.mp4
// is a copy of thumb-hover.upscaled.source.mp4), with the still at 0.5. Then
// `npm run media` for the web copies. Needs ffmpeg on the PATH.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const sharp = createRequire(import.meta.url)('sharp')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(ROOT, 'src/assets/projects/intel-the-light-keeper')
const dir = path.join(base, 'used') // what the site uses (outputs)
const kept = path.join(base, 'unused') // the originals and upscales
const args = process.argv.slice(2)
const withClip = args.includes('--clip')
const share = Math.min(1, Math.max(0, parseFloat(args.find((a) => !a.startsWith('--')) ?? '0.5')))

// The still: the original brought up to the upscale's size (Lanczos) and mixed with it.
const up = sharp(path.join(kept, 'thumb.upscaled.source.png'))
const { width: W, height: H } = await up.metadata()
const a = await sharp(path.join(kept, 'thumb.source.png')).resize(W, H, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
const b = await up.ensureAlpha().raw().toBuffer()
const mixed = Buffer.alloc(b.length)
for (let i = 0; i < b.length; i++) mixed[i] = Math.round(a[i] * (1 - share) + b[i] * share)
await sharp(mixed, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(dir, 'thumb.png'))

// The clip (--clip only): the same window of 05.MOV, scaled up the same way, averaged
// frame by frame with the upscaled clip (blend's all_expr: A the original, B the upscale).
if (!withClip) {
  console.log(`intel-the-light-keeper: thumb.png at ${share} of the way from the original to the upscale (the clip left as it is)`)
  process.exit(0)
}
const upClip = path.join(kept, 'thumb-hover.upscaled.source.mp4')
const [cw, ch] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', upClip], { encoding: 'utf8' }).trim().split(',')
const filter = `[0:v]crop=270:267:468:102,scale=${cw}:${ch}:flags=lanczos,fps=30,format=rgb24[a];[1:v]format=rgb24[b];[a][b]blend=all_expr='A*${(1 - share).toFixed(3)}+B*${share.toFixed(3)}',format=yuv420p`
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0', '-t', '1', '-i', path.join(dir, '05.mp4'), '-i', upClip, '-filter_complex', filter, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-an', '-movflags', '+faststart', path.join(dir, 'thumb-hover.mp4')], { stdio: 'inherit' })
console.log(`intel-the-light-keeper: thumb.png and thumb-hover.mp4 at ${share} of the way from the original to the upscale`)
