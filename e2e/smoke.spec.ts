import { test, expect } from '@playwright/test';

test('production assets, hash routes, preferences and narrow layout', async ({
  page,
  baseURL,
}) => {
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  const externalRequests: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(response.url());
  });
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      externalRequests.push(request.url());
  });

  await page.goto('./');
  await expect(page).toHaveURL(/#\/home$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '室友大改造',
  );
  await expect(page.locator('main')).toHaveCSS('min-width', '0px');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/home-${test.info().project.name}.png`,
    fullPage: true,
  });

  await page.getByRole('link', { name: /看看入住计划/u }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: '入住计划' }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: '入住计划' }),
  ).toBeVisible();
  await page.goto('./#/settings');
  await page.getByRole('checkbox', { name: /增强对比度/u }).check();
  await page.getByRole('checkbox', { name: /减少动态效果/u }).check();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: /增强对比度/u }),
  ).toBeChecked();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-reduce-motion',
    'true',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto('./#/not-a-room');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '这扇门后还没有房间',
  );
  await page.getByRole('link', { name: /回到首页/u }).click();
  expect(pageErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('keyboard navigation and system reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/home');
  await expect(page.locator('.art-spark-one')).toHaveCSS(
    'animation-name',
    'none',
  );
  // Start from the document rather than the heading focused after route navigation.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.keyboard.press('Control+Home');
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('link', { name: /看看入住计划/u }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { level: 1, name: '入住计划' }),
  ).toBeFocused();
});
