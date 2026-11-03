import { expect, test } from '@playwright/test';

test('opens the onboarding on the first launch', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Benvenuto in Palanche');
});
