import { findEvent } from '../src/data/events';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import { queuedEvent } from '../src/test/eventGame';
import { oldM3Game } from '../src/test/oldSave';
import type { GameState } from '../src/domain/model';
import { ACTIVITY } from '../src/data/constants';

const storageKey = 'roomdev:slot:1';
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
}
async function seed(
  page: Page,
  game: GameState | ReturnType<typeof oldM3Game> = createGame(Date.now()),
) {
  await page.addInitScript(
    ({ key, fixture }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            revision: 1,
            commitId: 'activity-fixture',
            game: fixture,
          }),
        );
    },
    { key: storageKey, fixture: game },
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('idle roommates choose once at settlement, honor manual actions and gifts, and retain real feedback after refresh', async ({
  page,
  isMobile,
}) => {
  const game = createGame(Date.now());
  await seed(page, game);
  await page.goto('./#/room');
  let panel = page.getByRole('region', {
    name: `和${game.characters[0]!.name}的日常`,
    exact: true,
  });
  await expect(panel).toContainText('日结算时室友会随机进行一次');
  await panel.getByRole('button', { name: '聊聊今天', exact: true }).click();
  await expect(panel).toContainText('今天已安排互动');
  await page
    .getByRole('button', { name: game.characters[1]!.name, exact: true })
    .click();
  panel = page.getByRole('region', {
    name: `和${game.characters[1]!.name}的日常`,
    exact: true,
  });
  await panel.getByRole('button', { name: '送出礼物 ♡', exact: true }).click();
  await expect(panel).toContainText('今天已安排互动');
  await page.reload();
  const before = (await stored(page)).game as GameState;
  expect(
    before.logs.filter((log) =>
      log.id.startsWith(ACTIVITY.autoInteractionPrefix),
    ),
  ).toHaveLength(0);
  const nextDay = page.getByRole('button', { name: /进入下一天/u });
  if (isMobile) await nextDay.tap();
  else await nextDay.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  const settled = (await stored(page)).game as GameState;
  const automatic = settled.logs
    .filter((log) => log.type === 'interaction')
    .filter((log) => log.id.startsWith(ACTIVITY.autoInteractionPrefix));
  expect(automatic.map((log) => log.characterId)).toEqual(
    game.characters.slice(2).map((character) => character.id),
  );
  expect(settled.wallet.tokens).toBe(
    before.wallet.tokens + ACTIVITY.dailyTokens,
  );
  for (const log of automatic) {
    expect(log.cost.energy + log.cost.stamina).toBeGreaterThan(0);
    expect(
      settled.characters
        .find((character) => character.id === log.characterId)!
        .growth.find(
          (entry) => entry.day === 1 && entry.source === 'interaction',
        )!.delta,
    ).toEqual(log.delta);
  }
  await page
    .getByRole('button', { name: game.characters[2]!.name, exact: true })
    .click();
  panel = page.getByRole('region', {
    name: `和${game.characters[2]!.name}的日常`,
    exact: true,
  });
  await expect(panel.locator('.activity-auto-receipt')).toContainText(
    '第 1 天',
  );
  await expect(panel.locator('.activity-auto-receipt')).toContainText(
    '自动日常',
  );
  await expect(panel).toContainText('普通互动 0 / 3');
  await expect(
    page.getByRole('table', { name: '第 1 天实际增减来源' }),
  ).toBeVisible();
  await noOverflow(page);
  await panel.screenshot({
    path: `artifacts/automatic-interaction-${test.info().project.name}.png`,
  });
  await page.reload();
  await expect(panel.locator('.activity-auto-receipt')).toContainText(
    '自动日常',
  );
  expect((await stored(page)).game.characters).toEqual(settled.characters);
  expect((await stored(page)).game.logs).toEqual(settled.logs);
});

test('fast automatic day progression chooses for every idle roommate once and does not repeat on focus or reload', async ({
  page,
}) => {
  const start = new Date('2026-10-25T08:00:00Z');
  await page.clock.install({ time: start });
  await seed(page, createGame(start.getTime()));
  await page.goto('./?fast=1#/room');
  await expect(page.getByText(/调试模式 · 每 1 分钟一天/u)).toBeVisible();
  await page.clock.runFor(60001);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  const settled = (await stored(page)).game as GameState;
  expect(
    settled.logs.filter((log) =>
      log.id.startsWith(ACTIVITY.autoInteractionPrefix),
    ),
  ).toHaveLength(4);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.reload();
  await expect(page.locator('.activity-auto-receipt')).toContainText(
    '自动日常',
  );
  expect((await stored(page)).game.characters).toEqual(settled.characters);
  expect((await stored(page)).game.logs).toEqual(settled.logs);
});

test('M4 ordinary interactions, gifts, actual costs, daily caps, source summary and refresh', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#/room');
  const panel = page.getByRole('region', { name: '和林小满的日常' });
  const activate = (locator: Locator) =>
    isMobile ? locator.tap() : locator.click();
  await activate(panel.getByRole('button', { name: '聊聊今天', exact: true }));
  await expect(panel).toContainText('普通互动 1 / 3');
  await activate(
    panel.getByRole('button', { name: '桌面整理接力', exact: true }),
  );
  await expect(panel).toContainText('普通互动 2 / 3');
  await panel
    .getByRole('button', { name: '一起伸个懒腰', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(panel).toContainText('普通互动 3 / 3');
  await expect(
    panel.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeDisabled();
  await panel.getByLabel('挑选一份小礼物').selectOption('ribbon');
  await activate(
    panel.getByRole('button', { name: '送出礼物 ♡', exact: true }),
  );
  await expect(panel).toContainText('送礼 1 / 1');
  await expect(panel).toContainText('心意点 12');
  await expect(
    panel.getByRole('button', { name: '送出礼物 ♡', exact: true }),
  ).toBeDisabled();
  const before = await stored(page);
  expect(before.game.characters[0].stats.progress).toBe(2);
  expect(before.game.characters[0].stats.energy).toBe(69);
  await page.reload();
  await expect(panel).toContainText('普通互动 3 / 3');
  await expect(panel).toContainText('送礼 1 / 1');
  expect((await stored(page)).game.characters).toEqual(before.game.characters);
  await noOverflow(page);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/m4-activity-${test.info().project.name}.png`,
  });
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(panel).toContainText('普通互动 0 / 3');
  await expect(panel).toContainText('送礼 0 / 1');
  await expect(panel).toContainText('心意点 20');
  const summary = page.getByRole('table', { name: '第 1 天实际增减来源' });
  await expect(
    summary.getByRole('row', { name: '男娘进度 +1 +2 0 +3', exact: true }),
  ).toBeVisible();
  expect((await stored(page)).game.characters[0].stats.progress).toBe(3);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('M4 queued story close, Escape, reload, choice, wardrobe reward and no duplicate payment', async ({
  page,
  isMobile,
}) => {
  const game = queuedEvent('ribbon-studio', Date.now());
  const pending = game.pendingEvents.find(
    (event) => event.eventId === 'ribbon-studio',
  )!;
  await seed(page, game);
  await page.goto('./#/room');
  const open = page.getByRole('button', {
    name: '查看「缎带小舞台」',
    exact: true,
  });
  const activate = (locator: Locator) =>
    isMobile ? locator.tap() : locator.click();
  const before = await stored(page);
  expect(before.game.wardrobe.unlockedIds).not.toContain('lace-shirt');
  await activate(open);
  const dialog = page.getByRole('dialog', { name: '缎带小舞台' });
  await expect(dialog).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/m4-event-${test.info().project.name}.png`,
  });
  await dialog.getByRole('button', { name: '稍后再说（不结算）' }).click();
  expect((await stored(page)).game.characters).toEqual(before.game.characters);
  expect((await stored(page)).game.wallet).toEqual(before.game.wallet);
  await expect(open).toBeFocused();
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.reload();
  await expect(open).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect((await stored(page)).game.pendingEvents).toEqual(
    before.game.pendingEvents,
  );
  await activate(open);
  await activate(
    dialog.getByRole('button', { name: '选择：自愿尝试新造型', exact: true }),
  );
  await expect(dialog).toHaveCount(0);
  await expect(open).toHaveCount(0);
  const after = await stored(page);
  expect(after.game.wallet.tokens).toBe(before.game.wallet.tokens - 2);
  expect(after.game.resolvedEventIds).toContain(pending.id);
  expect(after.game.wardrobe.unlockedIds).toContain('lace-shirt');
  expect(
    after.game.logs.filter(
      (log: { type: string; instanceId?: string }) =>
        log.type === 'event' && log.instanceId === pending.id,
    ),
  ).toHaveLength(1);
  await page.reload();
  expect((await stored(page)).game.wallet).toEqual(after.game.wallet);
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await page.getByRole('button', { name: '上衣', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^奶油花边衬衫，/ }),
  ).toBeEnabled();
});

test('M4 offline summary retains full branch queue and never opens or chooses dialogs automatically', async ({
  page,
}) => {
  const game = queuedEvent('ribbon-studio', Date.now());
  await page.clock.install({ time: new Date(game.clock.anchor) });
  await seed(page, game);
  await page.goto('./#/room');
  const before = await stored(page);
  await page.clock.setSystemTime(game.clock.anchor + 20 * 7200000 + 5000);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('13 天已舍弃');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await stored(page);
  expect(after.game.day).toBe(game.day + 7);
  expect(after.game.pendingEvents).toHaveLength(3);
  for (const event of before.game.pendingEvents)
    expect(after.game.pendingEvents).toContainEqual(event);
  expect(
    after.game.logs
      .filter(
        (log: { type: string; choiceId?: string }) => log.type === 'event',
      )
      .every((log: { eventId: string }) => !findEvent(log.eventId)!.branch),
  ).toBe(true);
  await expect(
    page.getByRole('region', { name: '待选择的小故事' }),
  ).toContainText('待选队列已满');
  await noOverflow(page);
});

test('M4 consent switches rerender interaction and event history immediately, preserving rapport', async ({
  page,
}) => {
  const game = queuedEvent('ribbon-studio', Date.now());
  game.settings.roleplay = true;
  game.characters[0]!.roleplay = true;
  await seed(page, game);
  await page.goto('./#/room');
  await page
    .getByRole('button', { name: '自愿角色扮演小游戏', exact: true })
    .click();
  await expect(page.locator('.activity-receipt')).toContainText('主人/男仆');
  await page
    .getByRole('button', { name: '查看「缎带小舞台」', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('主人/男仆');
  await page
    .getByRole('button', { name: '选择：自愿尝试新造型', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '查看「缎带小舞台」', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.game-logs')).toContainText('听话值');
  const before = await stored(page);
  await page.getByRole('link', { name: /偏好设置/ }).click();
  const globalSwitch = page.getByRole('checkbox', { name: /全局关系扮演许可/ });
  await globalSwitch.uncheck();
  await expect
    .poll(async () => (await stored(page)).game.settings.roleplay)
    .toBe(false);
  await page.getByRole('link', { name: '我的寝室', exact: true }).click();
  await expect(page.locator('.game-logs')).not.toContainText(
    /主人|男仆|听话值/,
  );
  await expect(
    page.getByRole('button', { name: '自愿角色扮演小游戏', exact: true }),
  ).toHaveCount(0);
  expect((await stored(page)).game.characters[0].stats.rapport).toBe(
    before.game.characters[0].stats.rapport,
  );
  await page.reload();
  await expect(page.locator('.game-logs')).not.toContainText(
    /主人|男仆|听话值/,
  );
});

test('M4 unaffordable choices stay pending with a free alternative; zero energy can recover', async ({
  page,
}) => {
  const game = queuedEvent('ribbon-studio', Date.now());
  game.wallet.tokens = 0;
  game.characters[0]!.stats.energy = 0;
  await seed(page, game);
  await page.goto('./#/room');
  await expect(
    page.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '一起伸个懒腰', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '聊聊今天', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '查看「缎带小舞台」', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: '选择：自愿尝试新造型', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('button', { name: '选择：只一起挑选颜色', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect((await stored(page)).game.wallet.tokens).toBe(2);
  expect((await stored(page)).game.wardrobe.unlockedIds).not.toContain(
    'lace-shirt',
  );
});

test('M4 real M3 archive migrates without retroactive events or wardrobe loss', async ({
  page,
}) => {
  const old = oldM3Game(createGame(Date.now()));
  old.characters[0]!.appearance.bottomColor = '#abcdee';
  old.resolvedEventIds.push('wardrobe:first-preset');
  await seed(page, old);
  await page.goto('./#/room');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 1 天',
  );
  await expect.poll(async () => (await stored(page)).game.version).toBe('1.6');
  const migrated = await stored(page);
  expect(migrated.game.characters[0].appearance).toEqual({
    ...old.characters[0]!.appearance,
    face: 'gentle',
  });
  expect(migrated.game.characters[0].stats).toEqual(old.characters[0]!.stats);
  expect(migrated.game.pendingEvents).toEqual([]);
  expect(migrated.game.wallet.tokens).toBe(20);
  expect(migrated.game.resolvedEventIds).toContain('wardrobe:first-preset');
  await page.getByRole('button', { name: '聊聊今天', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '和林小满的日常' }),
  ).toContainText('普通互动 1 / 3');
});
