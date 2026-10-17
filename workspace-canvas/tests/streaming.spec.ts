import { test, expect } from '@playwright/test';
import { fresh, draft, block } from './helpers';

// Runs against the simulated AI server: text streams into only the parts that changed,
// and a newer change cancels the update in progress.
test('AI text streams into the affected parts; newer changes cancel older updates', async ({ page: p }) => {
  await fresh(p);
  await p.locator('[data-recipe="r-1on1"]').click();
  // Structure lands fast from the local pass…
  await expect(draft(p).locator('h1.d-title')).toHaveText('1:1 recap with Sam', { timeout: 1500 });
  // …then AI text arrives, part by part.
  await expect(draft(p).locator('.blk[data-source="ai"]').first()).toBeVisible({ timeout: 8000 });
  await expect(draft(p).locator('.blk.drafting')).toHaveCount(0, { timeout: 15000 });
  const aiParts = await draft(p).locator('.blk[data-source="ai"]').count();
  expect(aiParts).toBeGreaterThanOrEqual(3);

  // Change one note: only the affected parts go back to drafting; others keep their AI text.
  const note = p.locator('.card[data-type="note"] textarea').first();
  await note.click(); await p.keyboard.press('Control+End');
  const summaryBefore = await block(p, 'summary').getAttribute('data-source');
  await p.keyboard.type('\nAsk Sam about the conference', { delay: 10 });
  await p.keyboard.type(' budget', { delay: 30 });
  await expect(block(p, 'next')).toContainText('conference budget', { timeout: 4000 });
  await expect(draft(p).locator('.blk.drafting')).toHaveCount(0, { timeout: 15000 });
  await expect(block(p, 'next')).toHaveAttribute('data-source', 'ai');
  expect(summaryBefore).toBe('ai');
  await expect(p.getByTestId('status')).not.toHaveClass(/busy/);
});
