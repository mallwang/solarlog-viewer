import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'dashboard', path: '/' },
  { name: 'day', path: '/#/day/2019/07/15' },
  { name: 'month', path: '/#/month/2008/07' },
  { name: 'year', path: '/#/year/2019' },
  { name: 'total', path: '/#/total' },
  { name: 'compare', path: '/#/compare' },
];

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseRgb(value) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a) + 0.05;
  const lb = relativeLuminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}

test.describe('Dark mode rendering across all six views (US1, FR-006)', () => {
  test.use({ colorScheme: 'dark' });

  for (const { name, path } of VIEWS) {
    test(`${name} view renders with no console/page errors and legible contrast`, async ({
      page,
    }) => {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      expect(errors).toEqual([]);

      const { bg, color } = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        color: getComputedStyle(document.body).color,
      }));
      const bgRgb = parseRgb(bg);
      const colorRgb = parseRgb(color);
      expect(bgRgb).not.toBeNull();
      expect(colorRgb).not.toBeNull();
      expect(contrastRatio(bgRgb, colorRgb)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
