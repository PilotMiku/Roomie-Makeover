import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createGame } from '../src/domain/initial';
import { customizeGame } from '../src/domain/customize';
import {
  decodeStored,
  exportArchive,
  previewImport,
} from '../src/domain/saves';
import { settleDay } from '../src/domain/rules';
import { multiRoomGame } from '../src/test/multiRoom';
import { queuedEvent } from '../src/test/eventGame';
import { encodeCompact } from '../src/domain/compactSave';
import { SAVES } from '../src/data/constants';

const storageKey = 'roomdev:slot:1';
async function seed(
  page: Page,
  game = createGame(Date.now()),
  raw = exportArchive(game),
) {
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: storageKey, raw },
  );
}
async function stored(page: Page) {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key)!,
    storageKey,
  );
  return decodeStored(JSON.parse(raw)).save.game;
}
function roomButton(page: Page, name: string) {
  return page
    .getByRole('region', { name: '寝室导航', exact: true })
    .getByRole('button', { name: new RegExp(name) });
}
async function createRoom(page: Page, name: string, capacity = 6) {
  await page
    .getByRole('button', { name: '＋ 新建隔壁寝室', exact: true })
    .click();
  await page.getByLabel('寝室名称', { exact: true }).fill(name);
  await page
    .getByRole('combobox', { name: '寝室容量', exact: true })
    .selectOption(String(capacity));
  await page
    .getByRole('combobox', { name: '床型', exact: true })
    .selectOption('bunk');
  await page
    .getByRole('combobox', { name: '卫浴主类型', exact: true })
    .selectOption('private');
  await page.getByLabel('干湿分离（仅独卫可选）', { exact: true }).check();
  await page
    .getByRole('button', { name: '创建这间寝室 ♡', exact: true })
    .click();
  await expect(roomButton(page, name)).toHaveAttribute('aria-pressed', 'true');
}
test('M6 creates a real neighbor dorm, adds an adult resident, moves a roommate and restores the selected room', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  await page.goto('./#/customize');
  await createRoom(page, '草莓糖小屋', 6);
  await page.getByLabel('室友姓名', { exact: true }).fill('桃桃');
  await page
    .getByRole('button', { name: '添加这位室友 ♡', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  const before = await stored(page);
  const room = before.rooms.find((item) => item.name === '草莓糖小屋')!;
  await page.getByRole('link', { name: /返回我的寝室/ }).click();
  await expect(page.locator('.bed-tile')).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: /1 号上铺：桃桃/ }),
  ).toBeVisible();
  if (isMobile) await roomButton(page, '晴窗小屋').tap();
  else await roomButton(page, '晴窗小屋').click();
  await page
    .getByLabel('林小满的目标寝室', { exact: true })
    .selectOption(room.id);
  await page
    .getByLabel('目标空床', { exact: true })
    .selectOption(room.beds[1]!.id);
  await page.getByRole('button', { name: '确认搬家', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /1 号下铺：林小满/ }),
  ).toBeVisible();
  const after = await stored(page);
  expect(after.characters[0]).toEqual({
    ...before.characters[0],
    roomId: room.id,
    bedId: room.beds[1]!.id,
  });
  expect(after.day).toBe(before.day);
  expect(after.randomSeed).toBe(before.randomSeed);
  await page.reload();
  await expect(roomButton(page, '草莓糖小屋')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('button', { name: /1 号下铺：林小满/ }),
  ).toBeVisible();
  expect((await stored(page)).characters).toHaveLength(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/m6-room-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .locator('.room-map-panel')
    .screenshot({ path: `artifacts/m6-map-${test.info().project.name}.png` });
  await page.getByRole('region', { name: '寝室导航', exact: true }).screenshot({
    path: `artifacts/m6-navigation-${test.info().project.name}.png`,
  });
  await page.getByRole('form', { name: '跨寝室搬家', exact: true }).screenshot({
    path: `artifacts/m6-migration-${test.info().project.name}.png`,
  });
  expect(errors).toEqual([]);
});

test('M6 filters all 24 roommates, locates an actor, settles all rooms once and blocks full targets', async ({
  page,
}) => {
  const game = multiRoomGame(Date.now());
  await seed(page, game);
  await page.goto('./#/room');
  await page.locator('.resident-browser > summary').click();
  await expect(page.locator('.browser-results .button')).toHaveCount(24);
  await page
    .getByRole('combobox', { name: '按寝室筛选', exact: true })
    .selectOption(game.rooms[2]!.id);
  await expect(page.locator('.browser-results .button')).toHaveCount(8);
  const actor = game.characters.find(
    (resident) => resident.roomId === game.rooms[2]!.id,
  )!;
  await page.getByLabel('搜索室友', { exact: true }).fill(actor.name);
  await expect(page.locator('.browser-results .button')).toHaveCount(1);
  await page
    .getByRole('button', {
      name: `查看${actor.name}的档案 · ${game.rooms[2]!.name}`,
      exact: true,
    })
    .click();
  await expect(roomButton(page, '月亮小屋')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.bed-tile')).toHaveCount(8);
  await expect(page.getByLabel('目标空床', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '确认搬家', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  const settled = await stored(page);
  expect(
    settled.characters.every((resident) => resident.settledDays === 1),
  ).toBe(true);
  expect(settled.eventProgress).toHaveLength(4);
  expect(settled.wallet.tokens).toBe(game.wallet.tokens + 8);
  for (const room of game.rooms)
    await roomButton(page, room.name.split(' · ')[1]!).click();
  expect((await stored(page)).day).toBe(2);
  expect((await stored(page)).characters).toEqual(settled.characters);
  await page.reload();
  expect((await stored(page)).characters).toEqual(settled.characters);
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await page
    .getByLabel('衣柜按寝室筛选', { exact: true })
    .selectOption(game.rooms[1]!.id);
  await expect(
    page.getByLabel('为谁挑选穿搭', { exact: true }).locator('option'),
  ).toHaveCount(6);
});

test('M6 permits empty beds at the global cap, prevents the 25th resident and caps rooms at six', async ({
  page,
}) => {
  await seed(page, multiRoomGame(Date.now()));
  await page.goto('./#/customize');
  await createRoom(page, '云朵空房', 4);
  await expect(page.getByText(/当前存档已有 24 位常住室友/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '添加这位室友 ♡', exact: true }),
  ).toBeDisabled();
  await createRoom(page, '奶油空房', 8);
  await expect(
    page.getByRole('button', { name: '＋ 新建隔壁寝室', exact: true }),
  ).toBeDisabled();
  const game = await stored(page);
  expect(game.rooms).toHaveLength(6);
  expect(game.characters).toHaveLength(24);
  await page.getByRole('link', { name: /返回我的寝室/ }).click();
  await expect(
    page.getByRole('heading', { name: '这间寝室还没有室友 ♡' }),
  ).toBeVisible();
  await expect(page.locator('.bed-tile')).toHaveCount(8);
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await page
    .getByLabel('衣柜按寝室筛选', { exact: true })
    .selectOption(game.rooms[5]!.id);
  await expect(
    page.getByRole('heading', { name: '这间寝室的衣架还空着 ♡' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('M6 migration keeps original event participants and pending decisions without rewarding again', async ({
  page,
}) => {
  let game = queuedEvent('shared-bath-kit', Date.now());
  game = customizeGame(
    game,
    {
      type: 'room-create',
      input: {
        name: '隔壁粉色小屋',
        capacity: 4,
        bedType: 'loft',
        facilities: { bathroom: 'shared', dryWet: false },
      },
    },
    Date.now(),
  ).game;
  const pending = game.pendingEvents.find(
    (item) => item.eventId === 'shared-bath-kit',
  )!;
  const actor = game.characters.find(
    (item) => item.id === pending.characterIds[0],
  )!;
  const target = game.rooms[1]!;
  await seed(page, game);
  await page.goto('./#/room');
  await page.getByRole('button', { name: actor.name, exact: true }).click();
  await page
    .getByLabel(`${actor.name}的目标寝室`, { exact: true })
    .selectOption(target.id);
  await page
    .getByLabel('目标空床', { exact: true })
    .selectOption(target.beds[0]!.id);
  await page.getByRole('button', { name: '确认搬家', exact: true }).click();
  await expect(roomButton(page, target.name)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await stored(page)).pendingEvents).toEqual(game.pendingEvents);
  await page
    .getByRole('button', {
      name: `查看「洗漱篮排队小剧场」 · ${game.rooms[0]!.name}`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`来自「${game.rooms[0]!.name}」`);
  await dialog
    .getByRole('button', { name: '选择：错峰出门，先休息', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await stored(page);
  expect(after.characters.find((item) => item.id === actor.id)!.roomId).toBe(
    target.id,
  );
  expect(after.resolvedEventIds).toContain(pending.id);
  expect(
    after.characters.find((item) => item.id === actor.id)!.stats.energy,
  ).toBeGreaterThan(actor.stats.energy);
  await page.reload();
  expect(
    (await stored(page)).resolvedEventIds.filter((id) => id === pending.id),
  ).toHaveLength(1);
});

test('M6 full 24-person long-running save survives real storage, download and compact JSON recovery', async ({
  page,
}) => {
  let game = multiRoomGame(Date.now(), [8, 8, 8]);
  for (let day = 1; day <= 305; day++) game = settleDay(game, day, 'manual');
  await seed(
    page,
    game,
    encodeCompact({ revision: 1, commitId: 'compact-history', game }),
  );
  await page.goto('./#/saves');
  await expect(page.locator('.save-alert')).toHaveCount(0);
  const rawRecord = await page.evaluate(
    (key) => localStorage.getItem(key)!,
    storageKey,
  );
  const record = JSON.parse(rawRecord);
  expect(decodeStored(record).save.game.characters).toEqual(game.characters);
  // A compact input can be normalized to ordinary JSON when it fits below the storage threshold.
  if (record.format) expect(record.format).toBe('roomdev-stats-tuples');
  else
    expect(Buffer.byteLength(rawRecord)).toBeLessThanOrEqual(
      SAVES.compactStorageBytes,
    );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前进度', exact: true }).click();
  const raw = await readFile((await (await downloadPromise).path())!, 'utf8');
  expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(previewImport(raw).game.characters).toEqual(game.characters);
  await page.getByLabel('选择 JSON 备份文件', { exact: true }).setInputFiles({
    name: 'full-dorm.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '确认恢复到槽位 1', exact: true })
    .click();
  await expect(page.getByRole('region', { name: '导入摘要' })).toHaveCount(0);
  await expect(page.locator('.save-alert')).toHaveCount(0);
  expect((await stored(page)).characters).toEqual(game.characters);
  expect((await stored(page)).logs).toHaveLength(300);
  await page.getByRole('link', { name: '继续当前故事 →', exact: true }).click();
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 307 天',
  );
  await page.reload();
  await expect(page.getByText('✓ 已保存到此浏览器')).toBeVisible();
  expect(
    (await stored(page)).characters.every((actor) => actor.settledDays === 306),
  ).toBe(true);
});

test('M6 readonly views can browse rooms and profiles without gaining management permissions', async ({
  page,
}) => {
  const game = multiRoomGame(Date.now(), [4, 6]);
  game.player.identity = 'parent';
  await seed(page, game);
  await page.goto('./#/room');
  await roomButton(page, '草莓小屋').click();
  await expect(
    page.getByRole('button', { name: '确认搬家', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: /自定义寝室与室友/ }).click();
  await expect(
    page.getByRole('button', { name: '＋ 新建隔壁寝室', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /03 室友档案/ }).click();
  await expect(page.getByLabel('室友姓名', { exact: true })).toBeDisabled();
  expect((await stored(page)).characters).toEqual(game.characters);
});
