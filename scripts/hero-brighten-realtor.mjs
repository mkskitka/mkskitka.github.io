// One-off: the Realtor.com hero (src/assets/projects/realtor-savings-simulator/used/hero.png)
// lifted everywhere but the arcade screen, so the cabinet and hands read through the
// page darkening while the screen stays as it was. Made from hero.source.png:
//   node scripts/hero-brighten-realtor.mjs <in.png> <out.png> [gamma=2]
// (unused/hero.source.png is the untouched photo; used/hero.png is the result, gamma 2.)
import { createRequire } from 'node:module'
const sharp = createRequire(import.meta.url)('sharp')
const [src, out, gainArg, liftArg] = process.argv.slice(2)
const gain = parseFloat(gainArg ?? '1.5'), lift = parseFloat(liftArg ?? '10')
const base = sharp(src).removeAlpha()
const { width: W, height: H } = await base.metadata()
// The arcade screen's corners (measured from the image), pushed out a little so the
// bezel's edge is inside the kept area, and feathered.
const grow = 6
const quad = [[900 - grow, 128 - grow], [2112 + grow, 80 - grow], [2004 + grow, 855 + grow], [862 - grow, 684 + grow]]
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><polygon points="${quad.map((p) => p.join(',')).join(' ')}" fill="white"/></svg>`
const mask = await sharp(Buffer.from(maskSvg)).blur(4).greyscale().raw().toBuffer()
const original = await base.raw().toBuffer()
// Lifted on a curve (a gamma of `gain`), so the dark cabinet and hands come up a lot
// while the phone's lit screen does not clip.
const lut = Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(v / 255, 1 / gain)))
const bright = Buffer.from(original.map((v) => lut[v]))
const mixed = Buffer.alloc(original.length)
for (let i = 0, p = 0; i < original.length; i += 3, p++) {
  const m = mask[p] / 255
  for (let c = 0; c < 3; c++) mixed[i + c] = Math.round(original[i + c] * m + bright[i + c] * (1 - m))
}
await sharp(mixed, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(out)
console.log('wrote', out)
