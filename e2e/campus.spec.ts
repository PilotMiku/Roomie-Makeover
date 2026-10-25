import { test, expect, type Page } from '@playwright/test';
import { createGame } from '../src/domain/initial';
import { syncWardrobeUnlocks } from '../src/domain/unlocks';
import { decodeStored, exportArchive } from '../src/domain/saves';
import { queuedEvent } from '../src/test/eventGame';
import type { GameState } from '../src/domain/model';

const key = 'roomdev:slot:1';
async function seed(page: Page, fixture: GameState) {
  await page.addInitScript(
    ({ storageKey, raw }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, raw);
    },
    { storageKey: key, raw: exportArchive(fixture) },
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
test('campus six faces, random default profession and durable identity cleanup', async ({
  page,
}) => {
  await page.goto('./#/customize');
  await page.getByRole('button', { name: /保存身份，布置寝室/ }).click();
  await page.getByRole('button', { name: /保存寝室，认识室友/ }).click();
  await expect(
    page
      .getByRole('group', { name: '面容模板', exact: true })
      .getByRole('radio'),
  ).toHaveCount(6);
  await expect(
    page.getByRole('combobox', { name: '专业', exact: true }),
  ).toHaveValue('random');
  await page.getByLabel('室友姓名', { exact: true }).fill('莓莓');
  await page.getByRole('radio', { name: /猫系雀斑/ }).check();
  await page.screenshot({
    path: 'artifacts/campus-faces-' + test.info().project.name + '.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: /添加这位室友/ }).click();
  await expect(page.getByRole('status')).toContainText('室友档案已保存');
  await page.getByRole('button', { name: /完成自定义，开始入住/ }).click();
  const before = await saved(page);
  expect(before.characters[0]!.appearance.face).toBe('cat');
  expect(['daily', 'custom', 'random']).not.toContain(
    before.characters[0]!.major,
  );
  const panel = page.getByRole('region', { name: '身份专属行动' });
  await panel.getByRole('button', { name: '发动寝室大扫除' }).click();
  await expect(panel).toContainText('宜居度 72 / 100');
  await expect(
    panel.getByRole('button', { name: '发动寝室大扫除' }),
  ).toBeDisabled();
  const after = await saved(page);
  expect(after.characters[0]!.stats.stamina).toBe(
    before.characters[0]!.stats.stamina - 6,
  );
  expect(after.characters[0]!.stats.rapport).toBeGreaterThan(
    before.characters[0]!.stats.rapport,
  );
  await page.reload();
  await expect(panel).toContainText('宜居度 72 / 100');
  expect((await saved(page)).characters).toEqual(after.characters);
  await expect(page.locator('main')).not.toContainText(/成年|18 岁/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'artifacts/campus-role-' + test.info().project.name + '.png',
    fullPage: true,
  });
});

test('campus 50/100 progress gates, conspicuous maid styling and map persist', async ({
  page,
}) => {
  const fixture = createGame(Date.now());
  fixture.characters[0]!.stats.progress = 100;
  fixture.characters[1]!.stats.progress = 50;
  fixture.characters[2]!.stats.progress = 49;
  await seed(page, syncWardrobeUnlocks(fixture));
  await page.goto('./#/wardrobe');
  await page.getByRole('button', { name: '一键穿上女仆装' }).click();
  await expect(page.getByRole('status')).toContainText('黑白女仆套装已应用');
  const preview = page.getByRole('img', {
    name: '林小满的完整穿搭预览',
    exact: true,
  });
  for (const layer of ['top', 'skirt', 'accessory', 'makeup'])
    expect(
      await preview.locator('[data-layer="' + layer + '"] rect').count(),
    ).toBeGreaterThan(0);
  await page.screenshot({
    path: 'artifacts/campus-maid-' + test.info().project.name + '.png',
    fullPage: true,
  });
  await page.reload();
  expect((await saved(page)).characters[0]!.outfit).toMatchObject({
    top: 'maid-blouse',
    skirt: 'maid-skirt',
    accessory: 'maid-headband',
    makeup: 'doll-makeup',
  });
  await page.getByLabel('为谁挑选穿搭').selectOption('resident-2');
  await expect(
    page.getByRole('button', { name: '一键穿上女仆装' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '裙装', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^樱花百褶裙，/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: /^黑白蕾丝女仆裙，/ }),
  ).toBeDisabled();
  await page.getByLabel('为谁挑选穿搭').selectOption('resident-3');
  await page.getByRole('button', { name: '裙装', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^樱花百褶裙，/ }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('campus parent can call and visit without occupying beds, with own pending story', async ({
  page,
}) => {
  const fixture = queuedEvent('parent-weekend-call', Date.now());
  await seed(page, fixture);
  await page.goto('./#/room');
  const panel = page.getByRole('region', { name: '身份专属行动' });
  await expect(panel.getByRole('button', { name: '打电话问候' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: '预约探望' })).toBeEnabled();
  await panel.getByRole('button', { name: '打电话问候' }).click();
  await expect(page.getByRole('status')).toContainText('身份行动已完成');
  await expect(panel.getByRole('button', { name: '预约探望' })).toBeDisabled();
  const after = await saved(page);
  expect(after.characters).toHaveLength(4);
  expect(
    after.logs.some(
      (log) => log.type === 'identity' && log.actionId === 'family-call',
    ),
  ).toBe(true);
  expect(
    after.pendingEvents.some(
      (pending) => pending.eventId === 'parent-weekend-call',
    ),
  ).toBe(true);
  await page.reload();
  expect((await saved(page)).pendingEvents).toEqual(after.pendingEvents);
});
