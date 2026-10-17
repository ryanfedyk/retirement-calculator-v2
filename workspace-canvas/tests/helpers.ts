import { expect, type Page } from '@playwright/test';

export const draft = (p: Page) => p.getByTestId('draft');
export const block = (p: Page, key: string) => p.locator(`.blk[data-key="${key}"]`);
export const card = (p: Page, text: string | RegExp) => p.locator('.card').filter({ hasText: text });

export async function fresh(p: Page) {
  await p.goto('/');
  await p.evaluate(() => new Promise<void>(r => { const req = indexedDB.deleteDatabase('workspace-canvas'); req.onsuccess = req.onerror = req.onblocked = () => r(); }));
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await expect(p.getByRole('heading', { name: 'What are you making?' })).toBeVisible();
}

/** Wait until the draft has settled after a change (no shimmer, status not busy). */
export async function settle(p: Page) {
  await expect(p.locator('.blk.pending')).toHaveCount(0);
  await p.waitForTimeout(250);
}

export async function addFromWorkspace(p: Page, query: string) {
  await p.locator('.tool[data-tool="at"]').click();
  await p.getByLabel('Search Workspace').fill(query);
  await p.locator('.pop .row.pick').first().click();
  await expect(p.locator('.pop')).toHaveCount(0);
}

/** Drag a card by its header to a screen position. */
export async function dragCard(p: Page, c: ReturnType<Page['locator']>, x: number, y: number) {
  const h = await c.locator('.c-head').boundingBox();
  if (!h) throw new Error('card not visible');
  const gx = h.x + 12, gy = h.y + h.height / 2;
  await p.mouse.move(gx, gy);
  await p.mouse.down();
  await p.mouse.move(gx + 8, gy + 8, { steps: 3 });
  await p.mouse.move(x, y, { steps: 8 });
  await p.mouse.up();
}
