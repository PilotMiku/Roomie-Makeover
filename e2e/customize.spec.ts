import { oldM3Game } from '../src/test/oldSave';
import { test, expect, type Page } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import { moveCharacter, settleDay } from '../src/domain/rules';

const key = 'roomdev:slot:1';
async function save(page: Page) {
  return page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    key,
  );
}
async function startCustomGame(page: Page) {
  await page.goto('./#/home');
  await page.getByRole('link', { name: /定制我的入住故事/ }).click();
  await page.getByRole('radio', { name: /寝室长/ }).check();
  await page.getByRole('button', { name: /保存身份，布置寝室/ }).click();
  await expect(page.getByLabel('寝室名称')).toBeVisible();
}
async function createResident(page: Page, name = '桃桃') {
  await page.getByLabel('室友姓名').fill(name);
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
}

test('M2 upgrades a real M1 archive without replacing residents, days or bed positions', async ({
  page,
}) => {
  let current = settleDay(createGame(Date.now()), 1, 'manual');
  current = moveCharacter(current, 'resident-1', 'room-101-bed-2');
  const old = oldM3Game(current);
  const { setup, ...oldGame } = old;
  void setup;
  const { customTitle, ...oldPlayer } = current.player;
  void customTitle;
  const legacy = {
    revision: 4,
    commitId: 'legacy-original',
    game: {
      ...oldGame,
      version: '1.0',
      player: oldPlayer,
      characters: old.characters.map(({ customMajor, ...character }) => {
        void customMajor;
        const { bottomColor, ...appearance } = character.appearance;
        void bottomColor;
        return { ...character, appearance };
      }),
    },
  };
  await page.addInitScript(
    ({ storageKey, fixture }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, JSON.stringify(fixture));
    },
    { storageKey: key, fixture: legacy },
  );
  await page.goto('./#/room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  await expect(
    page.getByRole('button', { name: /2 号床：林小满/ }),
  ).toBeVisible();
  await expect.poll(async () => (await save(page)).game.version).toBe('1.6');
  const migrated = await save(page);
  expect(migrated.game.characters[0].stats).toEqual(
    current.characters[0]!.stats,
  );
  expect(migrated.game.characters[0].growth).toEqual(
    current.characters[0]!.growth,
  );
  expect(migrated.game.setup).toBe('done');
  await page.getByRole('link', { name: /自定义寝室与室友/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '我的自定义工坊',
  );
  await page.getByRole('button', { name: /03 室友档案/ }).click();
  await page.getByRole('button', { name: '林小满', exact: true }).click();
  await expect(page.getByLabel('室友姓名')).toHaveValue('林小满');
  await page.reload();
  expect((await save(page)).game.characters).toEqual(migrated.game.characters);
});

test('M2 fresh identity, custom dorm, adult resident and persistent pink game', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#/home');
  await expect(page).toHaveTitle(/室友大改造/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '室友大改造',
  );
  await expect(page.locator('.button-primary').first()).toHaveCSS(
    'background-color',
    'rgb(184, 62, 112)',
  );
  await page.screenshot({
    path: `artifacts/m2-home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: /定制我的入住故事/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '写下你的入住小档案',
  );
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/成年|18 岁/);
  await page.screenshot({
    path: `artifacts/m2-identity-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('radio', { name: /自定义 给自己的视角/ }).check();
  await page.getByLabel('自定义身份名称').fill('樱花室友');
  await page.getByRole('button', { name: /保存身份，布置寝室/ }).click();
  await page.getByLabel('寝室名称').fill('草莓奶油屋');
  await page.getByLabel('寝室容量').selectOption('6');
  await page
    .getByRole('combobox', { name: '床型', exact: true })
    .selectOption('bunk');
  await page.getByLabel('卫浴主类型').selectOption('private');
  await page.getByRole('checkbox', { name: /干湿分离/ }).check();
  await page.screenshot({
    path: `artifacts/m2-room-config-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /保存寝室，认识室友/ }).click();
  await page.getByLabel('室友姓名').fill('桃桃');
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await page.getByLabel('日常称呼').fill('桃子');
  await page
    .getByRole('combobox', { name: '专业', exact: true })
    .selectOption('art');
  await page.getByRole('button', { name: '＋男娘', exact: true }).click();
  await page.getByLabel('上衣颜色', { exact: true }).fill('#ff88bb');
  await page.getByRole('checkbox', { name: /此室友自愿参与/ }).check();
  await page.screenshot({
    path: `artifacts/m2-resident-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  await page.reload();
  await expect(
    page.getByRole('button', { name: '桃桃', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /完成自定义，开始入住/ }).click();
  await expect(page).toHaveURL(/#\/room$/u);
  await expect(
    page.getByRole('heading', { name: '草莓奶油屋', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /3 号下铺：空床/ }),
  ).toBeVisible();
  await expect(page.getByText(/1 位室友 · 樱花室友视角/)).toBeVisible();
  await expect(page.getByRole('meter', { name: '默契值' })).toBeVisible();
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '晴窗里的第 2 天',
  );
  await expect(page.locator('.game-logs')).toContainText('桃桃 默契值 +2');
  const snapshot = await save(page);
  expect(snapshot.game.characters).toHaveLength(1);
  expect(snapshot.game.characters[0].age).toBe(20);
  expect(snapshot.game.player.age).toBe(20);
  await expect(page.locator('main')).not.toContainText(/成年|18 岁|20 岁/);
  expect(snapshot.game.rooms[0].beds).toHaveLength(6);
  expect(snapshot.game.characters[0].appearance.topColor).toBe('#ff88bb');
  await page.reload();
  expect((await save(page)).game.characters).toEqual(snapshot.game.characters);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/m2-game-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('M2 both consent switches rerender historical logs and preserve the same rapport', async ({
  page,
}) => {
  const game = createGame(Date.now());
  game.characters[0]!.roleplay = true;
  await page.addInitScript(
    ({ storageKey, fixture }) =>
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          revision: 1,
          commitId: 'consent-fixture',
          game: fixture,
        }),
      ),
    { storageKey: key, fixture: game },
  );
  await page.goto('./#/room');
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  const rapport = (await save(page)).game.characters[0].stats.rapport;
  await page.getByRole('link', { name: /偏好设置/ }).click();
  await page.getByRole('checkbox', { name: /全局关系扮演许可/ }).check();
  await expect
    .poll(async () => (await save(page)).game.settings.roleplay)
    .toBe(true);
  await page.getByRole('link', { name: '我的寝室', exact: true }).click();
  await expect(page.getByRole('meter', { name: '听话值' })).toBeVisible();
  await expect(page.locator('.game-logs')).toContainText('林小满 听话值 +2');
  await page.getByRole('link', { name: /偏好设置/ }).click();
  await page.getByRole('checkbox', { name: /全局关系扮演许可/ }).uncheck();
  await expect
    .poll(async () => (await save(page)).game.settings.roleplay)
    .toBe(false);
  await page.getByRole('link', { name: '我的寝室', exact: true }).click();
  await expect(page.getByRole('meter', { name: '默契值' })).toBeVisible();
  await expect(page.locator('.game-logs')).not.toContainText('听话值');
  await page.getByRole('link', { name: /自定义寝室与室友/ }).click();
  await page.getByRole('button', { name: /03 室友档案/ }).click();
  await page.getByRole('button', { name: '林小满', exact: true }).click();
  await page.getByRole('checkbox', { name: /此室友自愿参与/ }).uncheck();
  await page.getByRole('button', { name: '保存室友档案', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  await page.getByRole('link', { name: /偏好设置/ }).click();
  await page.getByRole('checkbox', { name: /全局关系扮演许可/ }).check();
  await expect
    .poll(async () => (await save(page)).game.settings.roleplay)
    .toBe(true);
  await page.getByRole('link', { name: '我的寝室', exact: true }).click();
  await expect(page.getByRole('meter', { name: '默契值' })).toBeVisible();
  await expect(page.locator('.game-logs')).not.toContainText('听话值');
  expect((await save(page)).game.characters[0].stats.rapport).toBe(rapport);
});

test('M2 parent viewpoint can finish onboarding, does not occupy a bed and cannot enable roleplay', async ({
  page,
}) => {
  await startCustomGame(page);
  await page.getByRole('button', { name: /01 玩家身份/ }).click();
  await page.getByRole('radio', { name: /家长/ }).check();
  await page.getByRole('button', { name: '保存玩家身份', exact: true }).click();
  await page.getByRole('button', { name: /保存寝室，认识室友/ }).click();
  await expect(
    page.getByRole('checkbox', { name: /此室友自愿参与/ }),
  ).toBeDisabled();
  await createResident(page);
  await page.getByRole('button', { name: /完成自定义，开始入住/ }).click();
  expect((await save(page)).game.characters).toHaveLength(1);
  await expect(page.getByText(/1 位室友 · 家长视角/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /1 号床：桃桃/ }),
  ).toBeDisabled();
  await page.getByRole('link', { name: /偏好设置/ }).click();
  await expect(
    page.getByRole('checkbox', { name: /全局关系扮演许可/ }),
  ).toBeDisabled();
});

test('M2 invalid custom text and facility combinations cannot pollute the game', async ({
  page,
}) => {
  await startCustomGame(page);
  await page.getByLabel('卫浴主类型').selectOption('private');
  await page.getByRole('checkbox', { name: /干湿分离/ }).check();
  await page.getByLabel('卫浴主类型').selectOption('shared');
  await expect(
    page.getByRole('checkbox', { name: /干湿分离/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /干湿分离/ })).toBeDisabled();
  await page.getByRole('button', { name: /保存寝室，认识室友/ }).click();
  await page.getByLabel('室友姓名').fill('17岁的朋友');
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('alert')).toContainText('大学校园');
  expect((await save(page)).game.characters).toHaveLength(0);
  await page.getByLabel('室友姓名').fill('桃桃');
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
});
