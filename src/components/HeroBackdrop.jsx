import BackgroundVideo from './BackgroundVideo.jsx'
import GridInkBackdrop from './GridInkBackdrop.jsx'
import { heroVideo } from '../data/videos.js'

/**
 * The full-bleed backdrop used behind the hero and the Systems menu.
 * Plays the hero video by default; pass `still` (an image URL) to show a static
 * image, or `sketch` to run the generative grid + ink backdrop (three.js) instead.
 * With `sketch`, `transparent` makes the canvas see-through except for the lines and
 * ink, and `behind` renders under it (used for the project image backdrop).
 * `nodeId` preserves the Webflow grid-placement id that site.css targets.
 */
export default function HeroBackdrop({ nodeId, nodeClass = '', still, sketch = false, transparent = false, behind = null, palette = null }) {
  return (
    <div className="ix_parallax-scale-out-hero radius_xlarge">
      <div className="w-layout-grid hero-overlay height_100percent">
        <div id={nodeId} className={`hero_back ${nodeClass}`}>
          <div className="text-color_on-overlay"></div>
          {behind}
          {sketch ? (
            <GridInkBackdrop className="image_cover ix_para position_absolute" transparent={transparent} palette={palette} />
          ) : still ? (
            <img src={still} alt="" className="image_cover ix_para position_absolute" />
          ) : (
            <BackgroundVideo video={heroVideo} className="image_cover ix_para position_absolute" />
          )}
        </div>
      </div>
    </div>
  )
}
