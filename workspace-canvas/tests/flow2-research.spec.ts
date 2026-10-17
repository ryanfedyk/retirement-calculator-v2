import { test, expect } from '@playwright/test';
import { fresh, draft, block, settle, addFromWorkspace, card, dragCard } from './helpers';

test('Flow 2: research to modeled outcomes with citations, pro/con groups, scenarios and muting', async ({ page: p }) => {
  await fresh(p);
  await p.getByLabel('What are you making?').fill('Should we roll out the support assistant?');
  await p.keyboard.press('Enter');
  await p.keyboard.type('We want faster replies without losing quality', { delay: 4 });
  await p.keyboard.press('Escape');

  // Add several sources from the Workspace.
  for (const q of ['pilot results', 'Relay', 'Security review of', 'Agent survey', 'Analyst note']) await addFromWorkspace(p, q);
  await settle(p);
  await expect(p.locator('.card[data-type="source"], .card[data-type="workspace"]')).toHaveCount(5);

  // Every claim from a source carries a citation; hovering one lights up its source card.
  expect(await draft(p).locator('sup.cite').count()).toBeGreaterThanOrEqual(5);
  const claim = draft(p).locator('.claim').filter({ hasText: '3.5 hours' }).first();
  await claim.hover();
  await expect(card(p, 'Support assistant pilot results')).toHaveClass(/trace/);
  // Highlighted passages on source cards.
  expect(await card(p, 'Support assistant pilot results').locator('mark').count()).toBeGreaterThan(0);

  // Group sources into "Pro" and "Con" columns: the draft restructures.
  // Make room: fit everything, then zoom out so there is empty canvas below the cards.
  await p.getByRole('button', { name: 'Fit everything in view' }).click();
  for (let i = 0; i < 3; i++) await p.locator('.zoombar').getByRole('button', { name: 'Zoom out' }).click();
  const board = (await p.locator('#board').boundingBox())!;
  const bottoms = await p.locator('.card').evaluateAll(els => Math.max(...els.map(e => e.getBoundingClientRect().bottom)));
  const colA = board.x + 60, colB = board.x + 330, top = bottoms + 30;
  for (const [x, label] of [[colA, 'Pro'], [colB, 'Con']] as const) {
    await p.mouse.dblclick(x, top);
    await p.keyboard.type(label);
    await p.keyboard.press('Escape');
  }
  await dragCard(p, card(p, 'Support assistant pilot results'), colA + 14, top + 40);
  await dragCard(p, card(p, 'Assistant pricing from Relay'), colA + 14, top + 150);
  await dragCard(p, card(p, 'Analyst note on AI'), colA + 14, top + 260);
  await dragCard(p, card(p, 'Security review of the assistant'), colB + 14, top + 40);
  await dragCard(p, card(p, 'Agent survey on AI tools'), colB + 14, top + 150);
  await settle(p);
  await expect(draft(p).locator('h2', { hasText: 'The case for' })).toBeVisible();
  await expect(draft(p).locator('h2', { hasText: 'The case against' })).toBeVisible();
  await expect(card(p, 'Security review of the assistant').locator('.ttag')).toContainText('in Con');

  // Assumptions at 10% and 30% give scenario tabs with modeled outcomes.
  await p.locator('.board').click({ position: { x: 40, y: 140 } });
  await p.keyboard.type('Assume 10% of agents adopt');
  await p.keyboard.press('Escape');
  await p.locator('.board').click({ position: { x: 40, y: 140 } });
  await p.keyboard.type('Assume 30% of agents adopt');
  await p.keyboard.press('Escape');
  await settle(p);
  const tabs = p.getByRole('tablist', { name: 'Scenarios' }).getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(block(p, 'outcome')).toContainText('about 60 of 600');
  await tabs.nth(1).click();
  await expect(block(p, 'outcome')).toContainText('about 180 of 600');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  const conclusion = block(p, 'conclusion');
  await expect(conclusion).toContainText('only once');
  await p.screenshot({ path: 'screens/flow2-research.png' });

  // Mute one source and watch the conclusion shift.
  const sec = card(p, 'Security review of the assistant');
  await sec.hover();
  await sec.getByRole('button', { name: 'Mute' }).click();
  await settle(p);
  await expect(sec).toHaveClass(/muted/);
  await expect(p.getByTestId('status')).toContainText(/conclusion (holds|shifted)/i);
  await expect(conclusion).toContainText('Roll it out');
  // In the List view (same seeds as an outline): unmute security, then mute the survey instead. The conclusion holds.
  await p.getByRole('button', { name: 'List', exact: true }).click();
  const row = (t: string) => p.locator('.lrow').filter({ hasText: t });
  await row('Security review of the assistant').getByRole('button', { name: 'Mute' }).click();
  await settle(p);
  await expect(conclusion).toContainText('only once');
  await row('Agent survey on AI tools').getByRole('button', { name: 'Mute' }).click();
  await settle(p);
  await expect(p.getByTestId('status')).toContainText(/conclusion holds/i);
  await expect(conclusion).toContainText('only once');
});
