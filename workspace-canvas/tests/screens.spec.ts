import { test, expect, type Page } from '@playwright/test';
import { fresh, settle } from './helpers';

// Visual review: desktop and phone, light and dark. Writes PNGs to screens/.
const sizes = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }];
const themes = ['light', 'dark'] as const;

async function theme(p: Page, t: string) { await p.evaluate(t => { localStorage.setItem('wc.theme', t); document.documentElement.dataset.theme = t; }, t); }

for (const sz of sizes) for (const t of themes) {
  test(`screens ${sz.name} ${t}`, async ({ page: p }) => {
    await p.setViewportSize({ width: sz.width, height: sz.height });
    await fresh(p);
    await theme(p, t); await p.reload();
    await expect(p.getByRole('heading', { name: 'What are you making?' })).toBeVisible();
    await p.screenshot({ path: `screens/${sz.name}-${t}-1-landing.png` });
    await p.locator('[data-recipe="r-qbr"]').click();
    await settle(p);
    await p.screenshot({ path: `screens/${sz.name}-${t}-2-deck.png` });
    if (sz.name === 'phone') {
      await p.locator('.draft .dh').click();
      await p.waitForTimeout(500);
      await p.screenshot({ path: `screens/${sz.name}-${t}-3-sheet.png` });
      await p.locator('.draft .dh').click();
    }
    await p.getByRole('button', { name: 'Back to start' }).click();
    await p.locator('[data-recipe="r-vendor"]').click();
    await settle(p);
    await p.screenshot({ path: `screens/${sz.name}-${t}-4-vendor.png` });
    if (sz.name === 'desktop') {
      await p.getByRole('button', { name: 'Back to start' }).click();
      await p.locator('[data-recipe="r-assist"]').click();
      await settle(p);
      await p.locator('.blk[data-key="outcome"]').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `screens/${sz.name}-${t}-5-assistant.png` });
      await p.getByRole('button', { name: 'Back to start' }).click();
      await p.screenshot({ path: `screens/${sz.name}-${t}-6-recents.png` });
    }
  });
}
