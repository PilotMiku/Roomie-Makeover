import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createGame } from '../src/domain/initial';
import { exportArchive } from '../src/domain/saves';
import { oldM3Game } from '../src/test/oldSave';
import { queuedEvent } from '../src/test/eventGame';
import type { GameState } from '../src/domain/model';

const key = 'roomdev:slot:1';
async function stored(page: Page, index = 1) {
  return page.evaluate((number) => {
    const raw = localStorage.getItem(`roomdev:slot:${number}`);
    return raw ? JSON.parse(raw) : null;
  }, index);
}
async function seed(page: Page, game: GameState = createGame(Date.now())) {
  await page.addInitScript(
    ({ storageKey, raw }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, raw);
    },
    { storageKey: key, raw: exportArchive(game) },
  );
}
function card(page: Page, index: number) {
  return page.getByRole('region', { name: `槽位 ${index}`, exact: true });
}
async function chooseFile(page: Page, raw: string, name = 'memory.json') {
  await page.getByLabel('选择 JSON 备份文件', { exact: true }).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
}

test('M5 five actual slots create, rename, select per tab, refresh and keep distinct stories', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await page.goto('./#/saves');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('region', { name: /^槽位 / })).toHaveCount(5);
  const original = (await stored(page)).game;
  for (let index = 2; index <= 5; index++) {
    await card(page, index)
      .getByLabel('新故事名称', { exact: true })
      .fill(`粉色日记 ${index}`);
    const create = card(page, index).getByRole('button', {
      name: '创建新故事',
      exact: true,
    });
    if (isMobile) await create.tap();
    else await create.click();
    await expect(card(page, index)).toContainText('♡ 当前故事');
    expect((await stored(page, index)).game.characters).toEqual([]);
  }
  await expect(
    page.getByRole('button', { name: '创建新故事', exact: true }),
  ).toHaveCount(0);
  await card(page, 2)
    .getByLabel('存档名称', { exact: true })
    .fill('草莓奶油寝室');
  await card(page, 2)
    .getByRole('button', { name: '保存名称', exact: true })
    .click();
  await expect(
    card(page, 2).getByRole('heading', { name: '草莓奶油寝室' }),
  ).toBeVisible();
  await page.reload();
  await expect(card(page, 5)).toContainText('♡ 当前故事');
  await card(page, 1)
    .getByRole('button', { name: '进入该存档', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(card(page, 1)).toContainText('♡ 当前故事');
  expect((await stored(page)).game.characters).toEqual(original.characters);
  await page.getByRole('link', { name: '继续当前故事 →', exact: true }).click();
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  expect((await stored(page, 5)).game.day).toBe(1);
  await page
    .getByRole('link', { name: /回忆存档/ })
    .first()
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/m5-saves-${test.info().project.name}.png`,
    fullPage: true,
  });
  await card(page, 1).screenshot({
    path: `artifacts/m5-card-${test.info().project.name}.png`,
  });
  expect(errors).toEqual([]);
});

test('M5 downloaded JSON roundtrip restores pending stories, wardrobe and stats; overwrite cancellation keeps the target', async ({
  page,
}) => {
  const game = queuedEvent('ribbon-studio', Date.now());
  await seed(page, game);
  await page.goto('./#/saves');
  const downloadPromise = page.waitForEvent('download');
  await card(page, 1)
    .getByRole('button', { name: '导出当前进度', exact: true })
    .click();
  const download = await downloadPromise;
  const raw = await readFile((await download.path())!, 'utf8');
  const exported = JSON.parse(raw);
  expect(download.suggestedFilename()).toMatch(/Roomie-Makeover-slot-1-day-/);
  await chooseFile(page, raw);
  await expect(page.getByRole('region', { name: '导入摘要' })).toBeVisible();
  await page
    .getByLabel('恢复到哪个槽位', { exact: true })
    .selectOption('slot-2');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('button', { name: '确认恢复到槽位 2', exact: true })
    .click();
  expect(await stored(page, 2)).toBeNull();
  await page.screenshot({
    path: `artifacts/m5-import-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('region', { name: '导入摘要' }).screenshot({
    path: `artifacts/m5-preview-${test.info().project.name}.png`,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '确认恢复到槽位 2', exact: true })
    .click();
  await expect(page.getByRole('region', { name: '导入摘要' })).toHaveCount(0);
  const restored = (await stored(page, 2)).game;
  for (const field of [
    'characters',
    'wardrobe',
    'pendingEvents',
    'resolvedEventIds',
    'randomSeed',
    'wallet',
    'legacy',
    'logs',
  ])
    expect(restored[field]).toEqual(exported.game[field]);
  expect(restored.slotId).toBe('slot-2');
  expect(restored.day).toBe(exported.game.day);
  await card(page, 2)
    .getByRole('button', { name: '进入该存档', exact: true })
    .click();
  await expect(card(page, 2)).toContainText('♡ 当前故事');
  await page.reload();
  await expect(card(page, 2)).toContainText('♡ 当前故事');
  await page.getByRole('link', { name: '继续当前故事 →', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '查看「缎带小舞台」', exact: true }),
  ).toBeVisible();
  expect((await stored(page)).game.pendingEvents).toEqual(game.pendingEvents);
});

test('M5 bad, future, non-adult, duplicate and oversized files leave a valid archive byte-for-byte unchanged', async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await seed(page, createGame(now));
  await page.goto('./#/saves');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '把回忆收好 ♡',
  );
  // Let the lazy route finish before freezing React's scheduling timers.
  await page.clock.pauseAt(new Date(now + 60000));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect
    .poll(async () => (await stored(page)).game.clock.lastObserved)
    .toBe(now + 60000);
  await expect
    .poll(async () => (await stored(page)).revision)
    .toBeGreaterThan(0);
  const original = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  const future = createGame(now);
  const minor = createGame(now);
  minor.characters[0]!.age = 17;
  const duplicate = createGame(now);
  duplicate.characters[1]!.id = duplicate.characters[0]!.id;
  const files = [
    { raw: '{broken', expected: /JSON 无法读取/ },
    {
      raw: JSON.stringify({
        revision: 1,
        commitId: 'future',
        game: { ...future, version: '99.0' },
      }),
      expected: /暂不支持存档版本/,
    },
    {
      raw: JSON.stringify({ revision: 1, commitId: 'minor', game: minor }),
      expected: /校验失败/,
    },
    {
      raw: JSON.stringify({
        revision: 1,
        commitId: 'duplicate',
        game: duplicate,
      }),
      expected: /校验失败/,
    },
    { raw: ' '.repeat(2 * 1024 * 1024 + 1), expected: /2 MiB/ },
  ];
  for (const file of files) {
    await chooseFile(page, file.raw);
    await expect(page.getByRole('alert')).toContainText(file.expected);
    await expect(page.getByRole('region', { name: '导入摘要' })).toHaveCount(0);
    expect(
      await page.evaluate(
        (storageKey) => localStorage.getItem(storageKey),
        key,
      ),
    ).toBe(original);
  }
  const invalidUtf8 = Buffer.from(exportArchive(createGame(now)));
  invalidUtf8[invalidUtf8.indexOf(Buffer.from('林小满'))] = 255;
  await page.getByLabel('选择 JSON 备份文件', { exact: true }).setInputFiles({
    name: 'broken-utf8.json',
    mimeType: 'application/json',
    buffer: invalidUtf8,
  });
  await expect(page.getByRole('alert')).toContainText('UTF-8');
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe(original);
});

test('M5 migration preserves original bytes for download after reload; corrupt slot can be explicitly recovered', async ({
  page,
}) => {
  const old =
    '\uFEFF' +
    JSON.stringify(
      { revision: 3, commitId: 'old', game: oldM3Game(createGame(Date.now())) },
      null,
      2,
    );
  await page.addInitScript(
    ({ storageKey, raw }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, raw);
    },
    { storageKey: key, raw: old },
  );
  await page.goto('./#/saves');
  await expect(
    card(page, 1).getByRole('button', { name: '导出原始旧档', exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await stored(page)).game.version).toBe('1.6');
  await page.reload();
  const downloadPromise = page.waitForEvent('download');
  await card(page, 1)
    .getByRole('button', { name: '导出原始旧档', exact: true })
    .click();
  expect(await readFile((await (await downloadPromise).path())!, 'utf8')).toBe(
    old,
  );
  const broken = '{original-broken';
  await page.evaluate(
    ({ storageKey, raw }) => localStorage.setItem(storageKey, raw),
    { storageKey: key, raw: broken },
  );
  await page.reload();
  await expect(page.locator('.save-alert')).toContainText('原始数据已保留');
  const brokenDownload = page.waitForEvent('download');
  await card(page, 1)
    .getByRole('button', { name: '下载原始文件', exact: true })
    .click();
  expect(await readFile((await (await brokenDownload).path())!, 'utf8')).toBe(
    broken,
  );
  await chooseFile(page, exportArchive(createGame(Date.now())));
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '确认恢复到槽位 1', exact: true })
    .click();
  await expect(page.locator('.save-alert')).toHaveCount(0);
  await expect(card(page, 1)).toContainText('4 位室友');
  await chooseFile(page, old, 'bom-original.json');
  await page
    .getByLabel('恢复到哪个槽位', { exact: true })
    .selectOption('slot-2');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '确认恢复到槽位 2', exact: true })
    .click();
  await expect(page.getByRole('region', { name: '导入摘要' })).toHaveCount(0);
  expect((await stored(page, 2)).sourceRaw).toBe(old);
});

test('M5 confirmed deletion clears one diary only, survives refresh and prevents stale resurrection', async ({
  page,
  context,
}) => {
  await seed(page);
  await page.addInitScript(
    (raw) => {
      if (!localStorage.getItem('roomdev:slot:2'))
        localStorage.setItem('roomdev:slot:2', raw);
    },
    exportArchive({ ...createGame(Date.now()), slotId: 'slot-2' }),
  );
  await page.goto('./#/saves');
  const stale = await context.newPage();
  await stale.goto('./#/room');
  await expect(page.locator('.save-alert')).toContainText('其他标签页');
  const second = (await stored(stale, 2)).game;
  await stale
    .getByRole('link', { name: /回忆存档/ })
    .first()
    .click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await card(page, 1)
    .getByRole('button', { name: '删除存档', exact: true })
    .click();
  expect((await stored(page)).deleted).toBeUndefined();
  stale.once('dialog', (dialog) => dialog.accept());
  await card(stale, 1)
    .getByRole('button', { name: '删除存档', exact: true })
    .click();
  await expect(card(stale, 1)).toContainText('空白日记');
  expect((await stored(stale)).deleted).toBe(true);
  await page.reload();
  await expect(card(page, 1)).toContainText('空白日记');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await stored(page)).deleted).toBe(true);
  expect((await stored(page, 2)).game).toEqual(second);
  await stale.close();
});

test('M5 different active slots in separate tabs can both progress without conflicting', async ({
  page,
  context,
}) => {
  await seed(page);
  await page.addInitScript(
    (raw) => {
      if (!localStorage.getItem('roomdev:slot:2'))
        localStorage.setItem('roomdev:slot:2', raw);
    },
    exportArchive({ ...createGame(Date.now()), slotId: 'slot-2' }),
  );
  await page.goto('./#/room');
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  const other = await context.newPage();
  await other.addInitScript(() =>
    sessionStorage.setItem('roomdev:active-slot', 'slot-2'),
  );
  await other.goto('./#/room');
  await expect(other.getByText('✓ 已保存到此浏览器')).toBeVisible();
  await expect(page.locator('.save-alert')).toHaveCount(0);
  await other.getByRole('button', { name: /进入下一天/ }).click();
  await expect(other.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  await expect(page.locator('.save-alert')).toHaveCount(0);
  await expect(other.locator('.save-alert')).toHaveCount(0);
  expect((await stored(page)).game.day).toBe(2);
  expect((await stored(page, 2)).game.day).toBe(2);
  await other.close();
});

test('M5 quota failure keeps memory progress exportable, blocks a switch and recovers on retry', async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(
    (raw) => {
      if (!localStorage.getItem('roomdev:slot:2'))
        localStorage.setItem('roomdev:slot:2', raw);
    },
    exportArchive({ ...createGame(Date.now()), slotId: 'slot-2' }),
  );
  await page.goto('./#/room');
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  const before = await stored(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, '__restoreSaveStorage', {
      configurable: true,
      value: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey.startsWith('roomdev:slot:'))
        throw new DOMException('full', 'QuotaExceededError');
      original.call(this, storageKey, value);
    };
  });
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  await expect(page.locator('.save-alert')).toContainText('存储写入失败');
  await page
    .getByRole('link', { name: /回忆存档/ })
    .first()
    .click();
  await card(page, 2)
    .getByRole('button', { name: '进入该存档', exact: true })
    .click();
  await expect(page.getByText(/当前进度尚未可靠保存，无法切换/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await card(page, 1)
    .getByRole('button', { name: '导出当前进度', exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloadPromise).path())!, 'utf8'),
  );
  expect(backup.game.day).toBe(2);
  expect((await stored(page)).game.day).toBe(before.game.day);
  await page.evaluate(() => {
    (
      window as unknown as { __restoreSaveStorage: () => void }
    ).__restoreSaveStorage();
  });
  await page
    .getByRole('button', { name: '重试保存当前进度', exact: true })
    .click();
  await expect(page.locator('.save-alert')).toHaveCount(0);
  expect((await stored(page)).game.day).toBe(2);
  await card(page, 2)
    .getByRole('button', { name: '进入该存档', exact: true })
    .click();
  await expect(card(page, 2)).toContainText('♡ 当前故事');
});
