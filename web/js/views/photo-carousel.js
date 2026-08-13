import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { emptyStateBody } from './empty-state.js';

const AUTO_ROTATE_MS = 6000;

/**
 * Renders the welcome page's photo carousel region (FR-008/009/010): the shared empty state with
 * no `<img>` for zero photos, a single non-interactive `<img>` with no prev/next controls for
 * exactly one, and a browsable strip with prev/next controls for two or more. `initCarousel`
 * wires the actual rotation/click behavior onto this markup once mounted.
 * @param {string[]} photoSrcs - resolved `img/plant/...` URLs, already in display order.
 * @returns {string} HTML markup for the carousel region.
 */
const CONTROL_BUTTON_CLASSES =
  'absolute top-1/2 -translate-y-1/2 flex items-center justify-center size-9 rounded-full ' +
  'bg-bg-elevated/80 text-text shadow hover:bg-bg-elevated';

export function carouselMarkup(photoSrcs) {
  if (photoSrcs.length === 0) {
    return `<div class="carousel carousel--empty rounded-2xl overflow-hidden">${emptyStateBody('welcome.carouselPlaceholder')}</div>`;
  }

  const slides = photoSrcs
    .map(
      (src, i) =>
        `<img class="carousel__slide block w-full aspect-[3/2] object-cover rounded-2xl" src="${src}" alt="" data-index="${i}" ${i === 0 ? '' : 'hidden'}>`,
    )
    .join('');

  const controls =
    photoSrcs.length > 1
      ? `<button type="button" class="carousel__prev ${CONTROL_BUTTON_CLASSES} left-2" aria-label="${t('welcome.carouselPrev')}">${icon('backward')}</button>
    <button type="button" class="carousel__next ${CONTROL_BUTTON_CLASSES} right-2" aria-label="${t('welcome.carouselNext')}">${icon('forward')}</button>`
      : '';

  return `<div class="carousel relative rounded-2xl overflow-hidden">
    <div class="carousel__slides relative">${slides}</div>
    ${controls}
  </div>`;
}

/**
 * Wires auto-rotation and prev/next controls for a carousel previously mounted via
 * `carouselMarkup()`. No-ops (returns a no-op cleanup) for 0 or 1 photos, since there is nothing
 * to rotate between.
 * @param {HTMLElement} carouselEl - The `.carousel` element mounted via `carouselMarkup()`.
 * @returns {() => void} Cleanup - clears the rotation interval and removes listeners.
 */
export function initCarousel(carouselEl) {
  const slides = [...carouselEl.querySelectorAll('.carousel__slide')];
  if (slides.length <= 1) return () => {};

  let current = 0;
  const show = (index) => {
    slides[current].hidden = true;
    current = (index + slides.length) % slides.length;
    slides[current].hidden = false;
  };

  const prevButton = carouselEl.querySelector('.carousel__prev');
  const nextButton = carouselEl.querySelector('.carousel__next');
  const onPrev = () => show(current - 1);
  const onNext = () => show(current + 1);
  prevButton?.addEventListener('click', onPrev);
  nextButton?.addEventListener('click', onNext);

  const intervalId = setInterval(() => show(current + 1), AUTO_ROTATE_MS);

  return () => {
    clearInterval(intervalId);
    prevButton?.removeEventListener('click', onPrev);
    nextButton?.removeEventListener('click', onNext);
  };
}
