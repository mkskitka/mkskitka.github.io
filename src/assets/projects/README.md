# Project photos and videos

One folder per project, named by the project's slug (the part of its URL after
`/projects/`). Drop files straight into the folder; nothing else needs registering.

    src/assets/projects/
      pgn-immersive-mobility-rehab/
        hero.mp4          <- plays behind the title (optional)
        hero.jpg          <- still hero, or the poster frame for hero.mp4
        01.jpg            <- showcase photos, in name order
        02.png
        ...
      realtor-savings-simulator/
      ...

## Hero (the full-screen backdrop behind the project title)

- `hero.jpg` / `hero.png` / `hero.webp`  -> a still photo.
- `hero.mp4` (plus `hero.webm` if you have one) -> a looping muted video.
  Add `hero.jpg` or `hero-poster.jpg` next to it as the poster frame.
- No hero file -> the site-wide hero video is used, same as today.
- To pick a differently named file, set `hero: 'some-file.jpg'` (or `.mp4`) on the
  project in `src/data/projects.js`.

## Thumbnail (the tile in the Systems grid on the home page)

- `thumb.jpg` / `thumb.png` / `thumb.webp` / `thumb.gif` -> a still or animated image.
- `thumb.mp4` (plus `thumb.webm` if you have one) -> a looping muted video.
  Add `thumb.jpg` or `thumb-poster.jpg` next to it as the poster frame.
- No thumb file -> the project's first showcase image is used.
- To pick a differently named file, set `thumb: 'some-file.gif'` on the project in
  `src/data/projects.js`.
- Tiles are square; the image is cropped to fit (centered), so square sources look best.

## Showcase (the scrolling collage lower on the page)

- If the project has a `featured` list in `src/data/projects.js`, that list wins.
  Reference folder files by bare name: `tile('01.jpg', { width: '44vw', ... })`.
  Paths starting with `/` still point at `public/` (e.g. `/images/x.png`).
- If there is no `featured` list, the first four images in the folder (sorted by
  name, hero files skipped) are laid out automatically.

Supported: png, jpg, jpeg, webp, gif, avif, mp4, webm. Keep videos under ~20 MB.
