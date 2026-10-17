import { test, expect } from '@playwright/test';
import { fresh, draft, block, settle } from './helpers';

test('Flow 1: quick notes become a titled, sectioned doc that tightens and respects a pin', async ({ page: p }) => {
  await fresh(p);
  await p.getByLabel('What are you making?').fill('Q4 pricing proposal');
  await p.keyboard.press('Enter');

  // A new canvas starts as one note with the cursor in it.
  const note = p.locator('.card.pg textarea');
  await expect(note).toBeFocused();
  await p.keyboard.type('We should raise the Pro plan by 10% in January\nEnterprise pricing stays fixed for renewals\nOffer a discount for annual billing\nFollow up with Finance on margin impact by Friday', { delay: 4 });
  await settle(p);

  // A titled, sectioned doc appears.
  await expect(draft(p).locator('h1.d-title')).toHaveText('Q4 pricing proposal');
  expect(await draft(p).locator('.page h2').count()).toBeGreaterThanOrEqual(2);
  await expect(block(p, 'next')).toContainText('Follow up with Finance');
  await expect(p.getByTestId('open-in')).toHaveText('Open in Docs');
  const wordsBefore = parseInt((await p.getByTestId('draft-sub').textContent())!.replace(/\D+/g, ''));

  // A direction tightens it.
  await p.keyboard.type('\nThis is for my manager, keep it under a page', { delay: 4 });
  await settle(p);
  await expect(p.locator('.card.pg .rec .d')).toContainText('Direction');
  await expect(draft(p).locator('.d-meta')).toContainText('For my manager');
  await expect(draft(p).locator('.d-meta')).toContainText('Under a page');
  const wordsAfter = parseInt((await p.getByTestId('draft-sub').textContent())!.replace(/\D+/g, ''));
  expect(wordsAfter).toBeLessThanOrEqual(wordsBefore);
  await expect(p.getByTestId('status')).toContainText('Updated');
  await expect(p.getByTestId('status').getByRole('button', { name: 'Undo' })).toBeVisible();

  // Pin the opening paragraph, then keep typing: the rest reflows, the pin stays.
  const summary = block(p, 'summary');
  await summary.hover();
  await summary.getByTestId('pin').click();
  await expect(summary).toHaveAttribute('data-source', 'pin');
  const pinned = await summary.locator('.bb').innerText();

  await note.click();
  await p.keyboard.press('Control+End');
  await p.keyboard.type('\nAdd a student discount next fall', { delay: 4 });
  await settle(p);
  await expect(draft(p)).toContainText('student discount');
  await expect(summary.locator('.bb')).toHaveText(pinned);
  await expect(summary).toHaveAttribute('data-source', 'pin');
  await p.screenshot({ path: 'screens/flow1-doc.png' });

  // Edit in the draft: it becomes a seed in the Draft edits stack and holds.
  const pricing = p.locator('.blk[data-kind="section"]').filter({ hasText: 'discount for annual billing' }).first();
  await pricing.locator('.bb li').first().click();
  await p.keyboard.press('End');
  await p.keyboard.type(' (needs CFO sign-off)');
  await p.locator('.board').click({ position: { x: 600, y: 600 } });
  await expect(p.locator('.card[data-type="edits"]')).toContainText('Edited in draft');
  await expect(pricing).toHaveAttribute('data-source', 'edit');
  await expect(pricing).toContainText('needs CFO sign-off');

  // Nothing is lost: reopening restores the canvas.
  await p.waitForTimeout(600);
  await p.reload();
  await p.locator('.recent').first().click();
  await expect(draft(p).locator('h1.d-title')).toHaveText('Q4 pricing proposal');
  await expect(draft(p)).toContainText('needs CFO sign-off');
  await expect(block(p, 'summary')).toHaveAttribute('data-source', 'pin');
});

test('Deleting a card can be restored from the toast, and undo works from the keyboard', async ({ page: p }) => {
  await fresh(p);
  await p.locator('[data-recipe="r-1on1"]').click();
  await settle(p);
  const dir = p.locator('.card[data-type="direction"]');
  await dir.hover();
  await dir.getByRole('button', { name: 'Delete' }).click();
  await expect(dir).toHaveCount(0);
  await p.locator('.toast').getByRole('button', { name: 'Restore' }).click();
  await expect(p.locator('.card[data-type="direction"]')).toHaveCount(1);
  await p.locator('.board').click({ position: { x: 700, y: 650 } });
  await p.keyboard.press('Control+z');
  await expect(p.locator('.card[data-type="direction"]')).toHaveCount(0);
  await p.keyboard.press('Control+Shift+z');
  await expect(p.locator('.card[data-type="direction"]')).toHaveCount(1);
});
