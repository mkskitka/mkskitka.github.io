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
- `thumb-hover.mp4` (plus `thumb-hover.webm` if you have one) -> a few seconds of
  video the tile plays, muted, while the mouse is over it (never on a phone). Cut one
  from a video in the folder with `node scripts/thumb-hover.mjs <slug> <video> <start>`.
  `thumb.mp4` does the same, with `thumb.jpg` / `thumb-poster.jpg` as the still.
- No thumb file -> the project's first showcase image is used.
- To pick a differently named file, set `thumb: 'some-file.gif'` on the project in
  `src/data/projects.js`.
- Tiles are square; the image is cropped to fit (centered), so square sources look best.

## Gallery (the photo row in the project write-up; click for full screen)

- Any other images, gifs and videos (`.mp4` / `.webm`) in the folder become the
  gallery, up to four, sorted by name (so `01.jpg`, `02.mp4` ... controls the
  order). `hero.*` and `thumb.*` are skipped. Videos loop muted in the row and
  play with sound and controls when opened.
- For a different set or order, add `gallery: [{ src: 'a.jpg' }, { src: 'b.jpg' }]`
  to the project in `src/data/projects.js`.
- Browsers can't show HEIC or MOV files; convert to JPEG / MP4 first (Finder:
  right-click, Quick Actions, Convert Image).

## Showcase (the scrolling collage lower on the page)

- If the project has a `featured` list in `src/data/projects.js`, that list wins.
  Reference folder files by bare name: `tile('01.jpg', { width: '44vw', ... })`.
  Paths starting with `/` still point at `public/` (e.g. `/images/x.png`).
- If there is no `featured` list, the first four images in the folder (sorted by
  name, hero files skipped) are laid out automatically.

Supported: png, jpg, jpeg, webp, gif, avif, mp4, webm. Any size: the site does not
ship these files as they are.

## Web copies (what the site actually ships)

`npm run media` (scripts/media-web.mjs; it also runs by itself before `npm run dev`
and `npm run build`) makes a web-sized copy of every file here in
`src/assets/web/<slug>/`, and the site reads only those:

- images become `.webp`, no larger than 2000 px (thumb.* 640 px); gifs are copied as
  they are so they keep animating;
- videos are re-encoded to H.264 no larger than 1280 px and at most 30 fps, and each
  gets a `<name>-poster.webp` frame that shows in the gallery row before it plays;
  a video that is already small is copied as it is;
- `*.source.*`, `.MOV` and `.HEIC` files are skipped, so originals can live here too.

Names keep their stem: `02.PNG` here is `02.webp` there, and a name in
`src/data/projects.js` (`thumb: '02.PNG'`) still finds it. Only files newer than their
copy are redone, so a run is quick. Needs ffmpeg (`brew install ffmpeg`).
