#!/usr/bin/env node
// Sync the VISUALS tiles from an Instagram account.
//
// Pulls the newest posts from the Instagram API (via Facebook Login: the
// Instagram Business account is linked to a Facebook Page), downloads each
// post's image, crops it to a square, and writes the list the home page reads
// (src/data/instagram.json). Posts that are deleted or archived on Instagram
// drop out on the next run, because the list and the image folder are rebuilt
// from scratch every time.
//
//   INSTAGRAM_ACCESS_TOKEN=... node scripts/instagram-sync.mjs
//
// The token is a Page access token (never expires) or a User access token (the
// script then looks up the Page and its token itself; user tokens expire after
// 60 days). One-time helper that turns a long-lived User token into the
// permanent Page token to store as the GitHub secret:
//
//   INSTAGRAM_ACCESS_TOKEN=<user token> node scripts/instagram-sync.mjs --page-token
//
// Options (environment):
//   INSTAGRAM_MAX    how many posts to keep (default 12; the scattered layout
//                    only has room for roughly 15-25 tiles on a laptop screen)
//   INSTAGRAM_SIZE   square size in px (default 800)
//
// Runs on a schedule in .github/workflows/instagram-sync.yml. See README
// "Instagram visuals" for the one-time setup (Meta app + token).

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IMAGE_DIR = path.join(ROOT, 'public/images/instagram')
const OUT_FILE = path.join(ROOT, 'src/data/instagram.json')
const API = 'https://graph.facebook.com/v22.0'
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}'

const MAX = Number(process.env.INSTAGRAM_MAX) || 12
const SIZE = Number(process.env.INSTAGRAM_SIZE) || 800

async function api(path, params) {
  const url = path.startsWith('http') ? path : `${API}/${path}?${new URLSearchParams(params)}`
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok || body.error) {
    const e = body.error || {}
    throw new Error(`Graph API: ${e.message || res.statusText} (code ${e.code ?? res.status})`)
  }
  return body
}

/** Find the Instagram Business account behind `token` and a Page token for it.
 *  Accepts a Page token (then /me is the Page) or a User token (then the Pages
 *  the user manages are listed and the first one linked to Instagram is used). */
export async function resolveAccount(token) {
  const fields = 'id,name,access_token,instagram_business_account{id,username}'
  const me = await api('me', { fields: 'id,name,instagram_business_account{id,username}', access_token: token }).catch(() => null)
  if (me?.instagram_business_account) {
    return { page: me.name, ig: me.instagram_business_account, token }
  }
  const pages = (await api('me/accounts', { fields, access_token: token })).data || []
  const page = pages.find((p) => p.instagram_business_account)
  if (!page) {
    const names = pages.map((p) => p.name).join(', ') || 'none'
    throw new Error(`no Facebook Page linked to an Instagram account (pages seen: ${names}). Link the Instagram account to a Page in the Instagram app: Settings → Business tools → Linked accounts.`)
  }
  return { page: page.name, ig: page.instagram_business_account, token: page.access_token }
}

/** Fetch up to `max` posts of `igId`, newest first, following pagination. */
export async function fetchPosts(token, igId, max = MAX) {
  const posts = []
  let next = `${igId}/media`
  let params = { fields: FIELDS, limit: Math.min(max, 50), access_token: token }
  while (next && posts.length < max) {
    const body = await api(next, params)
    posts.push(...(body.data || []))
    next = body.paging?.next || null
    params = undefined
  }
  return posts.slice(0, max)
}

/** The still image to show for a post: photos as-is, videos/reels use their
 *  thumbnail, carousels use their first item. Returns null when there is none
 *  (e.g. media_url withheld for copyright reasons). */
export function pickImage(post) {
  const still = (m) => (m?.media_type === 'VIDEO' ? m.thumbnail_url : m?.media_url) || null
  if (post.media_type === 'CAROUSEL_ALBUM') return still(post.children?.data?.[0]) || still(post)
  return still(post)
}

/** First line of the caption as the hover title, trimmed to a sensible length. */
export function titleFor(post) {
  const line = (post.caption || '').split('\n').map((s) => s.trim()).find(Boolean) || ''
  const clean = line.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Instagram post'
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean
}

/** Download `url` and save it as a centre-cropped square jpeg at `file`. */
export async function saveSquare(url, file, size = SIZE) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status}) ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await sharp(buf)
    .rotate() // honour EXIF orientation before cropping
    .resize(size, size, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(file)
}

async function main() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) {
    console.error('INSTAGRAM_ACCESS_TOKEN is not set. See README "Instagram visuals".')
    process.exit(1)
  }

  const account = await resolveAccount(token)
  if (process.argv.includes('--page-token')) {
    console.log(`Page: ${account.page}  Instagram: @${account.ig.username}\n`)
    console.log('Page access token (store this as INSTAGRAM_ACCESS_TOKEN; it does not expire):\n')
    console.log(account.token)
    return
  }
  console.log(`@${account.ig.username} via page "${account.page}"`)
  const posts = await fetchPosts(account.token, account.ig.id)
  console.log(`fetched ${posts.length} posts`)

  await mkdir(IMAGE_DIR, { recursive: true })
  const keep = new Set()
  const items = []
  for (const post of posts) {
    const src = pickImage(post)
    if (!src) {
      console.warn(`skip ${post.id}: no image url`)
      continue
    }
    const name = `${post.id}.jpg`
    try {
      await saveSquare(src, path.join(IMAGE_DIR, name))
    } catch (err) {
      console.warn(`skip ${post.id}: ${err.message}`)
      continue
    }
    keep.add(name)
    items.push({
      id: `ig-${post.id}`,
      title: titleFor(post),
      url: post.permalink,
      image: `/images/instagram/${name}`,
      timestamp: post.timestamp,
    })
  }

  // Drop images for posts that are no longer in the feed (deleted / archived).
  for (const f of await readdir(IMAGE_DIR)) {
    if (!keep.has(f)) await rm(path.join(IMAGE_DIR, f))
  }

  await writeFile(OUT_FILE, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`wrote ${items.length} tiles to ${path.relative(ROOT, OUT_FILE)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
