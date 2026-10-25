import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createGame } from '../src/domain/initial';
import {
  exportArchive,
  decodeStored,
  previewImport,
} from '../src/domain/saves';
import { oldCompactArchive } from '../src/test/oldSave';
import { completedGame } from '../src/test/completedGame';

const key = 'roomdev:slot:1';
async function game(page: Page) {
  return decodeStored(
    JSON.parse(
      await page.evaluate(
        (storageKey) => localStorage.getItem(storageKey)!,
        key,
      ),
    ),
  ).save.game;
}
function nav(page: Page, name: string) {
  return page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: new RegExp(name) });
}
async function seed(page: Page, raw = exportArchive(createGame(Date.now()))) {
  await page.addInitScript(
    ({ storageKey, value }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, value);
    },
    { storageKey: key, value: raw },
  );
}

test('M7 real college onboarding, wardrobe, 34 settlements, collections and confirmed new run with JSON recovery', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('./#/customize');
  await page.getByRole('button', { name: /保存身份，布置寝室/u }).click();
  await page.getByRole('button', { name: /保存寝室，认识室友/u }).click();
  await page.getByLabel('室友姓名', { exact: true }).fill('莓莓');
  await page
    .getByRole('combobox', { name: '专业', exact: true })
    .selectOption('computing');
  await page.getByRole('button', { name: /添加这位室友/u }).click();
  await page.getByRole('button', { name: /完成自定义，开始入住/u }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 1 天',
  );
  await nav(page, '换装衣柜').click();
  await page.getByLabel('套装名称', { exact: true }).fill('草莓开学日');
  await page
    .getByRole('button', { name: '收藏当前搭配 ♡', exact: true })
    .click();
  await expect(
    page.getByText('套装已收藏，发型、服装与配色一起保存 ♡'),
  ).toBeVisible();
  await nav(page, '我的寝室').click();
  for (let day = 1; day <= 33; day++) {
    await page.getByRole('button', { name: /进入下一天/u }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `第 ${day + 1} 天`,
    );
  }
  await nav(page, '星光纪念册').click();
  await expect(
    page.getByRole('button', { name: '开启新周目', exact: true }),
  ).toBeDisabled();
  await nav(page, '我的寝室').click();
  await page.getByRole('button', { name: /进入下一天/u }).click();
  await expect(
    page.getByRole('complementary', { name: '阶段养成完成' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '查看阶段目标与新周目', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '开启新周目', exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole('heading', { name: '闪闪发光的你', exact: true })
      .locator('..'),
  ).toContainText('✓ 已达成');
  await page.screenshot({
    path: `artifacts/m7-collection-${test.info().project.name}.png`,
    fullPage: true,
  });
  const completed = await game(page);
  expect(completed.characters[0]!.stats.progress).toBe(100);
  expect(completed.characters[0]!.settledDays).toBe(34);
  await page.evaluate(
    (raw) => localStorage.setItem('roomdev:slot:2', raw),
    exportArchive({ ...completed, slotId: 'slot-2' }),
  );
  const second = await page.evaluate(() =>
    localStorage.getItem('roomdev:slot:2'),
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '开启新周目', exact: true }).click();
  expect((await game(page)).characters).toEqual(completed.characters);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '开启新周目', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '写下你的入住小档案',
  );
  const next = await game(page);
  expect(next.day).toBe(1);
  expect(next.characters).toEqual([]);
  expect(next.legacy.runs).toBe(1);
  expect(next.legacy.portraits).toEqual(completed.legacy.portraits);
  expect(next.legacy.encyclopedia).toEqual(completed.legacy.encyclopedia);
  expect(next.legacy.achievements).toContain('graduate');
  expect(next.pendingEvents).toEqual([]);
  expect(next.logs).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem('roomdev:slot:2')),
  ).toBe(second);
  await nav(page, '星光纪念册').click();
  await page.getByRole('button', { name: /角色图鉴/u }).click();
  await expect(
    page.getByRole('heading', { name: '莓莓', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /服装图鉴/u }).click();
  await expect(
    page
      .getByRole('heading', { name: '奶油双丸子', exact: true })
      .locator('..'),
  ).toContainText('曾经收藏');
  await nav(page, '回忆存档').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前进度', exact: true }).click();
  const raw = await readFile((await (await download).path())!, 'utf8');
  expect(previewImport(raw).game.legacy).toEqual(next.legacy);
  await page.getByLabel('选择 JSON 备份文件', { exact: true }).setInputFiles({
    name: 'new-run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '确认恢复到槽位 1', exact: true })
    .click();
  await expect(page.getByRole('region', { name: '导入摘要' })).toHaveCount(0);
  await page.reload();
  expect((await game(page)).legacy).toEqual(next.legacy);
  expect(
    await page.evaluate(() => localStorage.getItem('roomdev:slot:2')),
  ).toBe(second);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('M7 offline reopening preserves the save and loads previously unopened lazy pages', async ({
  page,
  context,
  baseURL,
}) => {
  await seed(page);
  await page.goto('./#/room');
  await expect(
    page.getByRole('complementary', { name: '离线与更新' }),
  ).toContainText('已准备好离线使用');
  const manifest = await (
    await page.request.get(new URL('manifest.webmanifest', baseURL).href)
  ).json();
  expect(manifest.scope).toBe(new URL(baseURL!).pathname);
  expect(manifest.icons).toHaveLength(2);
  await page.getByRole('button', { name: /进入下一天/u }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  const before = await game(page);
  await context.setOffline(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(new URL('#/wardrobe', baseURL).href);
  await expect(reopened.getByRole('heading', { level: 1 })).toHaveText(
    '今天穿什么？🎀',
  );
  expect((await game(reopened)).characters).toEqual(before.characters);
  await nav(reopened, '星光纪念册').click();
  await expect(reopened.getByRole('heading', { level: 1 })).toHaveText(
    '星光纪念册',
  );
  await nav(reopened, '我的寝室').click();
  await reopened.getByRole('button', { name: /进入下一天/u }).click();
  await expect(reopened.getByRole('heading', { level: 1 })).toContainText(
    '第 3 天',
  );
  await reopened.reload();
  await expect(reopened.getByRole('heading', { level: 1 })).toContainText(
    '第 3 天',
  );
  await expect(
    reopened.getByRole('complementary', { name: '离线与更新' }),
  ).toContainText('离线游玩中');
  await reopened.screenshot({
    path: `artifacts/m7-offline-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('M7 sound starts muted, plays a real local chime on request, persists and stops when disabled', async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() => {
    const Original = window.Audio;
    Object.assign(window, { __playedChimes: 0 });
    window.Audio = class extends Original {
      constructor(src?: string) {
        super(src);
        this.addEventListener('playing', () => {
          const state = window as unknown as { __playedChimes: number };
          state.__playedChimes++;
        });
      }
    };
  });
  const plays = () =>
    page.evaluate(
      () => (window as unknown as { __playedChimes: number }).__playedChimes,
    );
  await page.goto('./#/settings');
  const toggle = page.getByRole('checkbox', { name: /开启本地音效/u });
  await expect(toggle).not.toBeChecked();
  expect(await plays()).toBe(0);
  await toggle.check();
  await expect(toggle).toBeChecked();
  await page.getByRole('button', { name: '试听音效', exact: true }).click();
  await expect.poll(plays).toBeGreaterThan(0);
  await page.reload();
  await expect(toggle).toBeChecked();
  expect(await plays()).toBe(0);
  await nav(page, '我的寝室').click();
  await page.getByRole('button', { name: '聊聊今天', exact: true }).click();
  await expect.poll(plays).toBeGreaterThan(0);
  await nav(page, '偏好设置').click();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  const before = await plays();
  await nav(page, '我的寝室').click();
  await page.getByRole('button', { name: '聊聊今天', exact: true }).click();
  expect(await plays()).toBe(before);
});

test('M7 migrates a real 1.3 compact archive and preserves its original bytes for recovery', async ({
  page,
}) => {
  const fixture = completedGame(Date.now());
  const raw = oldCompactArchive(fixture);
  await seed(page, raw);
  await page.goto('./#/room');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 35 天',
  );
  expect((await game(page)).version).toBe('1.6');
  expect((await game(page)).characters).toEqual(fixture.characters);
  await nav(page, '回忆存档').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出原始旧档', exact: true }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toBe(raw);
});
