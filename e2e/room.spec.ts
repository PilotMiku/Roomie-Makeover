import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createGame } from '../src/domain/initial';

const key = 'roomdev:slot:1';
// M1 regression runs on an existing save; new-player setup is covered separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ storageKey, game }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(
          storageKey,
          JSON.stringify({ revision: 1, commitId: 'm1-regression', game }),
        );
    },
    { storageKey: key, game: createGame(Date.now()) },
  );
});
async function stored(page: Page) {
  return page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    key,
  );
}
test('M1 room selection, accessible swap, bunk layout, day settlement and refresh', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#/home');
  await page.getByRole('link', { name: '进入我的寝室 →' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 1 天',
  );
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  const resident = page.getByRole('button', { name: '许知夏', exact: true });
  const target = page.getByRole('button', { name: /1 号床：林小满/ });
  if (isMobile) {
    await resident.tap();
    await target.tap();
  } else {
    await resident.click();
    await target.click();
  }
  await expect(
    page.getByRole('button', { name: /1 号床：许知夏/ }),
  ).toBeVisible();
  await page.getByLabel('为许知夏分配床位').selectOption('room-101-bed-4');
  await page.getByRole('button', { name: '分配 / 交换' }).click();
  await expect(
    page.getByRole('button', { name: /4 号床：许知夏/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: '双层床', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /2 号下铺：许知夏/ }),
  ).toBeVisible();
  await expect(page.locator('.pixel-avatar').first()).toHaveJSProperty(
    'naturalWidth',
    16,
  );
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  await expect(page.getByText('许知夏 · 第 1 天结算')).toBeVisible();
  const before = await stored(page);
  expect(before.game.characters[1].stats.progress).toBe(3);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  await expect(
    page.getByRole('button', { name: /2 号下铺：许知夏/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '双层床', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await stored(page)).game.characters).toEqual(before.game.characters);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/room-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `artifacts/room-viewport-${test.info().project.name}.png`,
  });
  expect(errors).toEqual([]);
});

test('M1 desktop dragging swaps and invalid drops keep positions', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'touch flow is covered by actual tap-to-swap in the primary flow',
  );
  await page.goto('./#/room');
  const first = page.getByTestId('bed-room-101-bed-1');
  const second = page.getByTestId('bed-room-101-bed-2');
  await first.dragTo(second);
  await expect(second).toContainText('林小满');
  const before = (await stored(page)).game.characters;
  await second.dragTo(page.locator('.map-window'));
  expect((await stored(page)).game.characters).toEqual(before);
});

test('M1 keyboard fallback works without dragging', async ({ page }) => {
  await page.goto('./#/room');
  await page.getByRole('button', { name: '周云舟', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /1 号床：林小满/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: /1 号床：周云舟/ }),
  ).toBeVisible();
});

test('M1 fast timer advances while visible and does not double settle on focus', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-24T10:00:00Z') });
  await page.goto('./?fast=1#/room');
  await expect(page.getByText(/调试模式 · 每 1 分钟一天/)).toBeVisible();
  await page.clock.runFor(60001);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  expect(
    (await stored(page)).game.logs.filter(
      (log: { type: string }) => log.type === 'day',
    ),
  ).toHaveLength(1);
  await page.screenshot({
    path: `artifacts/fast-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('M1 long offline catch-up and mode switch retain safe anchors', async ({
  page,
}) => {
  const start = new Date('2026-10-24T10:00:00Z');
  await page.clock.install({ time: start });
  await page.goto('./#/room');
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  const initial = await stored(page);
  await page.clock.setSystemTime(
    initial.game.clock.anchor + 12 * 7200000 + 30000,
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 8 天',
  );
  await expect(page.getByRole('status')).toContainText('5 天已舍弃');
  const save = await stored(page);
  expect(save.game.clock.anchor).toBe(initial.game.clock.anchor + 12 * 7200000);
  expect(
    save.game.clock.lastObserved - save.game.clock.anchor,
  ).toBeGreaterThanOrEqual(30000);
  expect(save.game.clock.lastObserved - save.game.clock.anchor).toBeLessThan(
    31000,
  );
  await page.goto('./?fast=1#/room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 8 天',
  );
  expect((await stored(page)).game.clock.mode).toBe('fast');
});

test('M1 invalid archives are preserved and backup downloads are exact', async ({
  page,
}) => {
  await page.goto('./#/home');
  await page.evaluate(
    (storageKey) => localStorage.setItem(storageKey, '{original-corrupt'),
    key,
  );
  await page.goto('./#/room');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('原始数据已保留');
  await expect(page.getByRole('button', { name: /进入下一天/ })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载未修改的原始备份' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'Roomie-Makeover-original-backup.json',
  );
  expect(await readFile((await download.path())!, 'utf8')).toBe(
    '{original-corrupt',
  );
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe('{original-corrupt');
});

test('M1 multiple tabs stop an older writer', async ({ page, context }) => {
  await page.goto('./#/room');
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  const other = await context.newPage();
  await other.goto('./#/room');
  await expect(other.getByText('✓ 已保存到此浏览器')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('其他标签页已修改此存档');
  await expect(page.getByRole('button', { name: /进入下一天/ })).toBeDisabled();
  await other.getByRole('button', { name: /进入下一天/ }).click();
  await expect(other.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  expect((await stored(page)).game.day).toBe(2);
  await other.close();
});

test('M1 missing safe storage support keeps memory progress and does not overwrite', async ({
  page,
}) => {
  await page.goto('./#/room');
  await expect
    .poll(async () => (await stored(page))?.revision)
    .toBeGreaterThan(0);
  const original = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { value: undefined }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    '当前环境无法安全保存存档',
  );
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe(original);
  await expect(
    page.getByRole('button', { name: '下载当前进度备份' }),
  ).toBeVisible();
});
