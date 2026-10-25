import { test, expect, type Page } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import { exportArchive, decodeStored } from '../src/domain/saves';
import { syncProgress } from '../src/domain/progress';
import { changeWardrobe } from '../src/domain/wardrobe';
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
test('previews do not spend resources; nap prevents leave and recovery shares durable daily limits', async ({
  page,
}) => {
  const fixture = createGame(Date.now());
  fixture.characters[0]!.stats.stamina = 4;
  await seed(page, fixture);
  await page.goto('./#/room');
  const tidy = page.getByRole('group', { name: '桌面整理接力', exact: true });
  await expect(tidy.getByRole('note')).toContainText(
    '体力将归零，请假 7 个游戏日',
  );
  const before = await saved(page);
  await page.getByLabel('挑选一份小礼物').selectOption('tea');
  await page.getByLabel('挑选一份小礼物').selectOption('bookmark');
  expect(await saved(page)).toEqual(before);
  const recovery = page.getByRole('region', { name: '主动恢复', exact: true });
  await recovery.getByRole('button', { name: '午睡片刻', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '和林小满的日常' }),
  ).toContainText('普通互动 1 / 3');
  await expect(tidy.getByRole('note')).toHaveCount(0);
  expect((await saved(page)).characters[0]!.stats.stamina).toBe(8);
  await recovery.getByRole('button', { name: '食堂加餐', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '和林小满的日常' }),
  ).toContainText('普通互动 2 / 3');
  const afterMeal = await saved(page);
  expect(afterMeal.wallet.tokens).toBe(before.wallet.tokens - 6);
  expect(afterMeal.characters[0]!.stats.progress).toBe(0);
  await page.reload();
  expect((await saved(page)).characters).toEqual(afterMeal.characters);
  await recovery.getByRole('button', { name: '室友安慰', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '和林小满的日常' }),
  ).toContainText('普通互动 3 / 3');
  await expect(
    recovery.getByRole('button', { name: '午睡片刻', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '送出礼物 ♡', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await recovery.screenshot({
    path: 'artifacts/recovery-' + test.info().project.name + '.png',
  });
});
test('ordinary action forecasts the complete energy and mood chain plus clothing recall', async ({
  page,
}) => {
  let fixture = createGame(Date.now());
  Object.assign(fixture.characters[0]!.stats, {
    energy: 3,
    mood: 1,
    affection: 41,
    progress: 100,
  });
  fixture = changeWardrobe(syncProgress(fixture), {
    type: 'maid-set',
    characterId: 'resident-1',
  }).game;
  await seed(page, fixture);
  await page.goto('./#/room');
  const talk = page.getByRole('group', { name: '聊聊今天', exact: true });
  await expect(talk.getByRole('note')).toContainText('精力将归零');
  await expect(talk.getByRole('note')).toContainText('心情将归零');
  await expect(talk.getByRole('note')).toContainText('预计好感 41 → 21');
  await expect(talk.getByRole('note')).toContainText('男娘进度 100 → 50');
  await expect(talk.getByRole('note')).toContainText('妆造将收起');
  await talk.screenshot({
    path: 'artifacts/consequence-' + test.info().project.name + '.png',
  });
  await talk.getByRole('button', { name: '聊聊今天', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('日常互动已结算');
  const actual = await saved(page);
  expect(actual.characters[0]!.stats).toMatchObject({
    affection: 21,
    progress: 50,
    energy: 0,
    mood: 0,
  });
  expect(actual.characters[0]!.outfit.top).toBe('basic-top');
  await page.reload();
  expect((await saved(page)).characters).toEqual(actual.characters);
});
test('group action exposes a resident risk and exact habitability before committing', async ({
  page,
}) => {
  const fixture = createGame(Date.now());
  fixture.rooms[0]!.habitability = 99;
  fixture.characters[0]!.stats.stamina = 6;
  await seed(page, fixture);
  await page.goto('./#/room');
  const group = page.getByRole('region', { name: '身份专属行动', exact: true });
  await expect(group.getByRole('note')).toContainText('林小满：体力将归零');
  await expect(group).toContainText('宜居度 99 → 100');
  await group.getByText('查看 4 位室友的预计数值', { exact: true }).click();
  await expect(group).toContainText('体力 -6');
  const before = await saved(page);
  expect(before.characters[0]!.stats.stamina).toBe(6);
  await group
    .getByRole('button', { name: '发动寝室大扫除', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('身份行动已完成');
  const after = await saved(page);
  expect(after.rooms[0]!.habitability).toBe(100);
  expect(after.characters[0]!.condition.leaveUntilDay).toBe(8);
  expect(after.characters[1]!.stats.stamina).toBe(
    before.characters[1]!.stats.stamina - 6,
  );
});
test('event choices forecast mood loss and offer a safe recovery alternative without choosing automatically', async ({
  page,
}) => {
  const fixture = queuedEvent('power-outage', Date.now());
  for (const character of fixture.characters)
    Object.assign(character.stats, {
      energy: 6,
      mood: 1,
      progress: 100,
      affection: 41,
    });
  await seed(page, syncProgress(fixture));
  await page.goto('./#/room');
  await page
    .getByRole('button', { name: '查看「短暂停电的晚上」', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: '短暂停电的晚上',
    exact: true,
  });
  const risky = dialog.locator('.event-choice').filter({
    has: page.getByRole('button', {
      name: '选择：用台灯继续学习',
      exact: true,
    }),
  });
  const safe = dialog.locator('.event-choice').filter({
    has: page.getByRole('button', {
      name: '选择：顺势早点休息',
      exact: true,
    }),
  });
  await expect(risky.getByRole('note')).toContainText('心情将归零');
  await expect(risky.getByRole('note')).toContainText('男娘进度 100 → 50');
  await expect(safe.getByRole('note')).toHaveCount(0);
  const before = await saved(page);
  expect(
    before.pendingEvents.some((row) => row.eventId === 'power-outage'),
  ).toBe(true);
  await safe
    .getByRole('button', { name: '选择：顺势早点休息', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await saved(page);
  expect(
    after.characters.every(
      (character) =>
        character.stats.progress === 100 && character.stats.mood > 0,
    ),
  ).toBe(true);
  expect(
    after.pendingEvents.some((row) => row.eventId === 'power-outage'),
  ).toBe(false);
  expect(after.logs.filter((log) => log.type === 'condition')).toHaveLength(
    before.logs.filter((log) => log.type === 'condition').length,
  );
});
