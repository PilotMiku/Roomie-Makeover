import { test, expect, type Page, type Locator } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import type { GameState } from '../src/domain/model';

const storageKey = 'roomdev:slot:1';
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
}
async function seed(page: Page, game: GameState = createGame(Date.now())) {
  await page.addInitScript(
    ({ key, fixture }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            revision: 1,
            commitId: 'wardrobe-fixture',
            game: fixture,
          }),
        );
    },
    { key: storageKey, fixture: game },
  );
}

test('M3 three visible layers, color preview, event unlock, presets and map avatar survive refresh', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const activate = async (locator: Locator) =>
    isMobile ? locator.tap() : locator.click();
  await page.goto('./#/room');
  const originalAvatar = await page
    .getByTestId('bed-room-101-bed-1')
    .locator('img')
    .getAttribute('src');
  const original = await stored(page);
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '今天穿什么？🎀',
  );
  const preview = page.getByRole('img', {
    name: '林小满的完整穿搭预览',
    exact: true,
  });
  const initialHair = await preview.locator('[data-layer="hair"]').innerHTML();
  const initialTop = await preview.locator('[data-layer="top"]').innerHTML();
  const initialBottom = await preview
    .locator('[data-layer="bottom"]')
    .innerHTML();
  await activate(page.getByRole('button', { name: /^缎带双马尾，/ }));
  await expect(
    page.getByRole('button', { name: /^缎带双马尾，/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await preview.locator('[data-layer="hair"]').innerHTML()).not.toBe(
    initialHair,
  );
  await page.getByRole('button', { name: '上衣', exact: true }).click();
  await activate(page.getByRole('button', { name: /^快乐小鸭衫，/ }));
  await expect(
    page.getByRole('button', { name: /^快乐小鸭衫，/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await preview.locator('[data-layer="top"]').innerHTML()).not.toBe(
    initialTop,
  );
  await page.getByRole('button', { name: '下装', exact: true }).click();
  await activate(page.getByRole('button', { name: /^蝴蝶结短裤，/ }));
  await expect(
    page.getByRole('button', { name: /^蝴蝶结短裤，/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await preview.locator('[data-layer="bottom"]').innerHTML()).not.toBe(
    initialBottom,
  );
  const beforeColors = await stored(page);
  await page.getByLabel('发色', { exact: true }).fill('#775588');
  await page.getByLabel('上衣颜色', { exact: true }).fill('#ff88bb');
  await page.getByLabel('下装颜色', { exact: true }).fill('#aabbcc');
  expect((await stored(page)).game.characters[0].appearance).toEqual(
    beforeColors.game.characters[0].appearance,
  );
  await expect(page.getByRole('button', { name: /随机搭配/ })).toBeDisabled();
  await page.getByRole('button', { name: '应用配色', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('配色已应用');
  await page.getByLabel('套装名称', { exact: true }).fill('樱桃奶油周末');
  await page.getByRole('button', { name: /收藏当前搭配/ }).click();
  await expect(page.getByRole('status')).toContainText('套装已收藏');
  await expect(
    page.getByRole('button', { name: /^小鸭条纹裤，/ }),
  ).toBeEnabled();
  let current = await stored(page);
  expect(
    current.game.characters.map(
      (character: { stats: unknown }) => character.stats,
    ),
  ).toEqual(
    original.game.characters.map(
      (character: { stats: unknown }) => character.stats,
    ),
  );
  const preset = current.game.wardrobe.presets[0];
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '樱桃奶油周末', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^奶油双丸子，/ }),
  ).toBeEnabled();
  expect((await stored(page)).game.wardrobe.presets[0]).toEqual(preset);
  await page.getByRole('button', { name: /随机搭配/ }).click();
  await expect(page.getByRole('status')).toContainText(
    '已从解锁服装中随机搭配',
  );
  await page
    .getByRole('button', { name: '应用「樱桃奶油周末」', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('已应用套装');
  current = await stored(page);
  expect(current.game.characters[0].outfit).toEqual(preset.outfit);
  expect(current.game.characters[0].appearance.bottomColor).toBe('#aabbcc');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/m3-wardrobe-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: /回到寝室/ }).click();
  await expect(
    page.getByTestId('bed-room-101-bed-1').locator('img'),
  ).not.toHaveAttribute('src', originalAvatar!);
  await page.screenshot({
    path: `artifacts/m3-map-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('M3 locked conditions unlock through natural settlement and reserved slots stay disabled', async ({
  page,
}) => {
  const game = createGame(Date.now());
  game.characters[0]!.stats.progress = 14;
  game.characters[0]!.stats.affection = 49;
  await seed(page, game);
  await page.goto('./#/wardrobe');
  await expect(
    page.getByRole('button', { name: /^云朵长卷发，/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /未开放$/ })).toHaveCount(4);
  for (const button of await page
    .getByRole('button', { name: /未开放$/ })
    .all())
    await expect(button).toBeDisabled();
  await page.getByRole('link', { name: /回到寝室/ }).click();
  await page.getByRole('button', { name: /进入下一天/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '第 2 天',
  );
  await expect(page.locator('.game-logs')).toContainText('衣柜上新');
  await page.getByRole('link', { name: /给室友换装/ }).click();
  await expect(
    page.getByRole('button', { name: /^云朵长卷发，/ }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '上衣', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^星星舞台衫，/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: /^奶油花边衬衫，/ }),
  ).toBeDisabled();
});

test('M3 keyboard outfit and palette-aware presets work across residents; delete keeps worn outfit', async ({
  page,
}) => {
  await seed(page);
  await page.goto('./#/wardrobe');
  await page.getByRole('button', { name: /^缎带双马尾，/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: /^缎带双马尾，/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('套装名称', { exact: true }).fill('通勤小可爱');
  await page.getByRole('button', { name: /收藏当前搭配/ }).click();
  await expect(page.getByRole('status')).toContainText('套装已收藏');
  const preset = (await stored(page)).game.wardrobe.presets[0];
  await page
    .getByRole('combobox', { name: '为谁挑选穿搭', exact: true })
    .selectOption('resident-2');
  await page
    .getByRole('button', { name: '应用「通勤小可爱」', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('已应用套装');
  const before = (await stored(page)).game.characters[1];
  expect(before.outfit).toEqual(preset.outfit);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '删除「通勤小可爱」', exact: true })
    .click();
  await expect(
    page.getByText('♡ 还没有收藏，从今天喜欢的造型开始吧。'),
  ).toBeVisible();
  expect((await stored(page)).game.characters[1]).toEqual(before);
  await page.reload();
  expect((await stored(page)).game.wardrobe.presets).toHaveLength(0);
});

test('M3 M2 editing does not reset worn clothes or a saved outfit', async ({
  page,
}) => {
  await seed(page);
  await page.goto('./#/wardrobe');
  await page.getByRole('button', { name: /^缎带双马尾，/ }).click();
  await expect(
    page.getByRole('button', { name: /^缎带双马尾，/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  const outfit = (await stored(page)).game.characters[0].outfit;
  await page.getByRole('link', { name: /自定义工坊/ }).click();
  await page.getByRole('button', { name: /03 室友档案/ }).click();
  await page.getByRole('button', { name: '林小满', exact: true }).click();
  await page.getByLabel('日常称呼', { exact: true }).fill('小满');
  await page.getByRole('button', { name: '保存室友档案', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  expect((await stored(page)).game.characters[0].outfit).toEqual(outfit);
});

test('M3 new or readonly players have an actionable, safe wardrobe', async ({
  page,
}) => {
  await page.goto('./#/wardrobe');
  await expect(
    page.getByRole('heading', { name: '先认识一位室友吧' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /去自定义工坊/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '写下你的入住小档案',
  );
  const game = createGame(Date.now());
  game.player.identity = 'parent';
  await page.evaluate(
    ({ key, fixture }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ revision: 20, commitId: 'readonly', game: fixture }),
      ),
    { key: storageKey, fixture: game },
  );
  await page.goto('./#/wardrobe');
  await page.reload();
  await expect(
    page.getByRole('button', { name: /^缎带双马尾，/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /随机搭配/ })).toBeDisabled();
});
