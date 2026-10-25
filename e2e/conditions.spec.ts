import { test, expect, type Page } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import { exportArchive, decodeStored } from '../src/domain/saves';
import { changeWardrobe } from '../src/domain/wardrobe';
import { syncProgress } from '../src/domain/progress';
import { queuedEvent } from '../src/test/eventGame';
import type { GameState } from '../src/domain/model';

const key = 'roomdev:slot:1';
async function seed(page: Page, game: GameState) {
  await page.addInitScript(
    ({ storageKey, raw }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, raw);
    },
    { storageKey: key, raw: exportArchive(game) },
  );
}
async function saved(page: Page) {
  return decodeStored(
    JSON.parse(
      await page.evaluate(
        (storageKey) => localStorage.getItem(storageKey)!,
        key,
      ),
    ),
  ).save.game;
}
test('tag grants 50 starting progress and opens dresses through real onboarding', async ({
  page,
}) => {
  await page.goto('./#/customize');
  await page.getByRole('button', { name: /保存身份，布置寝室/ }).click();
  await page.getByRole('button', { name: /保存寝室，认识室友/ }).click();
  await page.getByLabel('室友姓名', { exact: true }).fill('莓莓');
  await page.getByRole('button', { name: '＋男娘', exact: true }).click();
  await expect(page.getByText(/首次选择“男娘”标签/)).toBeVisible();
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  await page.getByRole('button', { name: /完成自定义，开始入住/ }).click();
  expect((await saved(page)).characters[0]!.stats.progress).toBe(50);
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await page.getByRole('button', { name: '裙装', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^樱花百褶裙，/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: '一键穿上女仆装' }),
  ).toBeDisabled();
  await page.reload();
  expect((await saved(page)).characters[0]!.stats.progress).toBe(50);
});
test('last stamina causes durable seven-day leave, daily recovery and playable return', async ({
  page,
}) => {
  const game = createGame(Date.now());
  game.characters = [game.characters[0]!];
  game.characters[0]!.stats.stamina = 4;
  await seed(page, game);
  await page.goto('./#/room');
  await page.getByRole('button', { name: '桌面整理接力', exact: true }).click();
  await expect(page.getByRole('note')).toContainText('还剩 7 个游戏日');
  await expect(
    page.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeDisabled();
  const progress = (await saved(page)).characters[0]!.stats.progress;
  await page.screenshot({
    path: 'artifacts/leave-' + test.info().project.name + '.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole('note')).toContainText('还剩 7 个游戏日');
  expect(
    (await saved(page)).logs.filter(
      (log) => log.type === 'condition' && log.reason === 'stamina',
    ),
  ).toHaveLength(1);
  for (let day = 1; day <= 7; day++) {
    await page.getByRole('button', { name: /进入下一天/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '第 ' + (day + 1) + ' 天',
    );
    expect((await saved(page)).characters[0]!.stats.progress).toBe(progress);
  }
  await expect(page.getByRole('note')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('a negative story shows tradeoffs, halves mood-breakdown progress, stores maid pieces and never charges twice', async ({
  page,
}) => {
  let game = queuedEvent('power-outage', Date.now());
  for (const character of game.characters) {
    character.stats.mood = 1;
    character.stats.progress = 100;
    character.stats.affection = 41;
  }
  game = changeWardrobe(syncProgress(game), {
    type: 'maid-set',
    characterId: 'resident-1',
  }).game;
  await seed(page, game);
  await page.goto('./#/room');
  await page
    .getByRole('button', { name: '查看「短暂停电的晚上」', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: '短暂停电的晚上',
    exact: true,
  });
  await expect(dialog).toContainText('心情 -4');
  await expect(dialog).toContainText('精力 +8');
  await page.screenshot({
    path: 'artifacts/risk-choice-' + test.info().project.name + '.png',
  });
  await dialog
    .getByRole('button', { name: '选择：用台灯继续学习', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await saved(page);
  expect(after.characters[0]!.stats).toMatchObject({
    progress: 50,
    affection: 20,
    mood: 0,
  });
  expect(after.characters[0]!.outfit).toMatchObject({
    top: 'basic-top',
    skirt: null,
    accessory: null,
    makeup: null,
  });
  expect(after.wardrobe.unlockedIds).toContain('maid-skirt');
  await page.reload();
  expect((await saved(page)).characters).toEqual(after.characters);
  await expect(page.locator('.game-logs')).toContainText('心情归零');
  await expect(
    page.getByRole('button', { name: '查看「短暂停电的晚上」', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
