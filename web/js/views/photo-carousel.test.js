import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carouselMarkup } from './photo-carousel.js';

test('carouselMarkup renders a placeholder with no <img> for zero photos', () => {
  const markup = carouselMarkup([]);
  assert.match(markup, /empty-state/);
  assert.doesNotMatch(markup, /<img/);
});

test('carouselMarkup renders a single <img> with no prev/next controls for one photo', () => {
  const markup = carouselMarkup(['img/plant/roof-array.jpg']);
  assert.match(markup, /<img[^>]*src="img\/plant\/roof-array\.jpg"/);
  assert.doesNotMatch(markup, /carousel__prev/);
  assert.doesNotMatch(markup, /carousel__next/);
});

test('carouselMarkup renders prev/next controls for two or more photos', () => {
  const markup = carouselMarkup(['img/plant/a.jpg', 'img/plant/b.jpg']);
  assert.match(markup, /<img[^>]*src="img\/plant\/a\.jpg"/);
  assert.match(markup, /<img[^>]*src="img\/plant\/b\.jpg"/);
  assert.match(markup, /carousel__prev/);
  assert.match(markup, /carousel__next/);
});
