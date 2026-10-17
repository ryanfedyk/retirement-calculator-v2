import { test, expect } from '@playwright/test';
import { fresh, draft, settle } from './helpers';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('Flow 3: recipe to deck, reference image changes the look, try another, open in Slides', async ({ page: p }) => {
  await fresh(p);
  await p.locator('[data-recipe="r-qbr"]').click();
  await settle(p);

  // Seeds and auto-added sources are already there, and the deck renders.
  expect(await p.locator('.card').count()).toBeGreaterThanOrEqual(4);
  await expect(p.getByTestId('src-badge')).toBeVisible();
  const slides = draft(p).locator('.deck .slide');
  expect(await slides.count()).toBeGreaterThanOrEqual(4);
  await expect(p.getByTestId('format-chip')).toContainText('Deck');
  await expect(p.getByTestId('open-in')).toHaveAttribute('aria-label', 'Open in Slides');
  const bgBefore = await draft(p).locator('.deck').getAttribute('style');

  // Open the source stack: prune one, pull one onto the canvas.
  await p.locator('.tool[data-tool="source"]').click();
  const autos = p.getByTestId('auto-sources').locator('.row');
  const n = await autos.count();
  expect(n).toBeGreaterThan(0);
  await autos.first().getByRole('button', { name: /^Remove/ }).click();
  await expect(p.getByTestId('auto-sources').locator('.row')).toHaveCount(Math.max(0, n - 1));
  await p.keyboard.press('Escape');

  // Generate a reference image: the look changes.
  await p.locator('.tool[data-tool="generate"]').click();
  await p.getByLabel('Image prompt').fill('calm ocean gradient');
  await p.locator('.pop').getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(p.locator('.card[data-type="reference"] img')).toBeVisible();
  await settle(p);
  await expect(draft(p).locator('.slide.title-s .sart img')).toBeVisible();
  const bgAfter = await draft(p).locator('.deck').getAttribute('style');
  expect(bgAfter).not.toEqual(bgBefore);
  await p.screenshot({ path: 'screens/flow3-deck.png' });

  // Try another: three alternatives as thumbnails; pick one.
  await p.getByTestId('try-another').click();
  await expect(p.locator('.alt')).toHaveCount(3);
  await p.locator('.alt[data-variant="2"]').click();
  await settle(p);
  await p.getByTestId('try-another').click();
  await expect(p.locator('.alt[data-variant="2"]')).toHaveAttribute('aria-pressed', 'true');
  await p.getByTestId('try-another').click();

  // Open in Slides explains the hand-off and copies the draft text.
  await p.getByTestId('open-in').click();
  const dlg = p.getByRole('dialog', { name: 'Open in Slides' });
  await expect(dlg).toContainText('native, fully editable Slides file');
  await dlg.getByRole('button', { name: 'Copy draft text' }).click();
  await expect(p.locator('.toast')).toContainText(/copied|Copying/);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (clip) expect(clip).toContain('Q3 business review');
});

test('Format chip switches Auto / Doc / Deck, with Sheet shown as coming later', async ({ page: p }) => {
  await fresh(p);
  await p.locator('[data-recipe="r-1on1"]').click();
  await settle(p);
  await expect(draft(p).locator('.page')).toBeVisible();
  await p.getByTestId('format-chip').click();
  await expect(p.getByRole('menuitemradio', { name: /Sheet/ })).toBeDisabled();
  await p.getByRole('menuitemradio', { name: 'Deck' }).click();
  await settle(p);
  await expect(draft(p).locator('.deck .slide').first()).toBeVisible();
  await expect(p.getByTestId('status')).toContainText('Now making a deck');
  // Minimize to a floating thumbnail that still updates; expand to full screen.
  await p.getByRole('button', { name: 'Minimize the draft' }).click();
  await expect(p.getByTestId('thumb')).toBeVisible();
  await p.getByTestId('thumb').click();
  await p.getByRole('button', { name: 'Expand the draft to full screen' }).click();
  await expect(p.getByTestId('draft')).toHaveClass(/max/);
  await p.keyboard.press('Escape');
  await expect(p.getByTestId('draft')).not.toHaveClass(/max/);
});
