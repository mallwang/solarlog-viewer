/**
 * @file Per-category render config (`.cloud` opacity/animation speed, how many of the sixteen
 * cloud elements stay visible, and whether the rain-streak/snow-flake layer is shown) used by
 * `sky-controller.js` to drive the `.sky-clouds` backdrop. Pure logic, no DOM access — see
 * research.md §4 and data-model.md §`WEATHER_CATEGORY_RENDER_CONFIG`. Renamed from
 * `sky/cloud-density.js`: this now drives strictly more than cloud density.
 */

/**
 * Per-category render config for the sixteen `.cloud` elements (index.html — the original six,
 * plus ten more added for the denser `mixed`/`cloudy`/`rain`/`snow` looks): `opacity` and
 * `animationDurationScale` are applied via CSS (see `[data-weather]` rules in app.css);
 * `visibleCount` is how many elements `sky-controller.js` should keep visible (the rest get
 * `hidden` set). `hasRainLayer`/`hasSnowLayer` gate the CSS-only rain-streak/snow-flake layers,
 * toggled `true` only for their own category. `cloudy`/`rain`/`snow` all max out at sixteen
 * visible clouds (`sky-controller.js` also sets `data-weather` on `<body>`, which drives their
 * background-gradient color plus the `.sky-overcast` full-cover static backdrop shared by all
 * three — see app.css); `rain`/`snow` additionally tint the clouds gray (see
 * `[data-weather='rain'|'snow'] .cloud` in app.css) and, like `cloudy`, hide the sun/moon
 * entirely rather than just dimming them — real overcast/rain/snow skies show no sun. `mixed`
 * shows ten cloud elements (up from four) at a higher opacity so it reads as noticeably cloudier
 * than `sunny` while still leaving the sun fully visible.
 * @type {Record<'sunny' | 'mixed' | 'cloudy' | 'rain' | 'snow', { opacity: number,
 *   animationDurationScale: number, visibleCount: number, hasRainLayer: boolean,
 *   hasSnowLayer: boolean }>}
 */
export const WEATHER_CATEGORY_RENDER_CONFIG = {
  sunny: {
    opacity: 0.35,
    animationDurationScale: 0.85,
    visibleCount: 2,
    hasRainLayer: false,
    hasSnowLayer: false,
  },
  mixed: {
    opacity: 0.8,
    animationDurationScale: 1.1,
    visibleCount: 10,
    hasRainLayer: false,
    hasSnowLayer: false,
  },
  cloudy: {
    opacity: 0.95,
    animationDurationScale: 1.3,
    visibleCount: 16,
    hasRainLayer: false,
    hasSnowLayer: false,
  },
  rain: {
    opacity: 0.95,
    animationDurationScale: 1.3,
    visibleCount: 16,
    hasRainLayer: true,
    hasSnowLayer: false,
  },
  snow: {
    opacity: 0.95,
    animationDurationScale: 1.3,
    visibleCount: 16,
    hasRainLayer: false,
    hasSnowLayer: true,
  },
};
