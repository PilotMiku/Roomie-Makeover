import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createGame } from '../src/domain/initial';
import { exportArchive, decodeStored } from '../src/domain/saves';

// Separate HTTP origin so update tests never modify a running build or another test's worker.
async function fixture(base: string, failedInstall = false) {
  let version = 1;
  const root = resolve('dist');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, 'http://localhost').pathname;
      if (!pathname.startsWith(base)) {
        response.writeHead(404).end();
        return;
      }
      const file = resolve(root, pathname.slice(base.length) || 'index.html');
      if (!file.startsWith(root + '/')) {
        response.writeHead(404).end();
        return;
      }
      let content = await readFile(file);
      if (file.endsWith('/index.html'))
        content = Buffer.from(
          content
            .toString()
            .replace(
              '<title>',
              `<meta name="fixture-version" content="${version}" /><title>`,
            ),
        );
      if (file.endsWith('/sw.js')) {
        let source = content
          .toString()
          .replace(
            'const CACHE_NAME = CACHE_PREFIX + ',
            `const CACHE_NAME = CACHE_PREFIX + "fixture-v${version}-" + `,
          );
        if (failedInstall)
          source = source.replace(
            'const ASSET_PATHS',
            `ASSETS.push(${JSON.stringify(base + 'missing-precache-file.txt')});\nconst ASSET_PATHS`,
          );
        content = Buffer.from(source);
      }
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.wav': 'audio/wav',
        '.webmanifest': 'application/manifest+json',
      };
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': file.endsWith('/sw.js')
          ? 'no-store'
          : 'public, max-age=3600',
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing local fixture port');
  return {
    url: `http://127.0.0.1:${address.port}${base}`,
    update: () => {
      version++;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

test('M7 a real worker update waits for consent, refuses unsaved progress and preserves saved gameplay and foreign caches', async ({
  page,
  baseURL,
}) => {
  const site = await fixture(new URL(baseURL!).pathname);
  try {
    await page.addInitScript(
      (raw) => {
        if (!localStorage.getItem('roomdev:slot:1'))
          localStorage.setItem('roomdev:slot:1', raw);
      },
      exportArchive(createGame(Date.now())),
    );
    await page.goto(site.url + '#/room');
    await expect(
      page.getByRole('complementary', { name: '离线与更新' }),
    ).toContainText('已准备好离线使用');
    await page.evaluate(async () => {
      await caches.open('foreign-fixture');
      Object.assign(window, {
        __oldController: navigator.serviceWorker.controller,
      });
    });
    site.update();
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    const update = page.getByRole('button', {
      name: '保存并更新应用',
      exact: true,
    });
    await expect(update).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          navigator.serviceWorker.controller ===
          (window as unknown as { __oldController: ServiceWorker })
            .__oldController,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      Object.assign(window, { __restoreStorage: Storage.prototype.setItem });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('roomdev:slot:'))
          throw new DOMException('full', 'QuotaExceededError');
        original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: /进入下一天/u }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '第 2 天',
    );
    await update.click();
    await expect(
      page.getByRole('complementary', { name: '离线与更新' }),
    ).toContainText('请先处理存档提示');
    expect(
      await page.evaluate(
        () =>
          navigator.serviceWorker.controller ===
          (window as unknown as { __oldController: ServiceWorker })
            .__oldController,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      Storage.prototype.setItem = (
        window as unknown as {
          __restoreStorage: typeof Storage.prototype.setItem;
        }
      ).__restoreStorage;
    });
    await page
      .getByRole('button', { name: '重试保存当前进度', exact: true })
      .click();
    await expect(
      page.getByText('✓ 已保存到此浏览器', { exact: true }),
    ).toBeVisible();
    const before = decodeStored(
      JSON.parse(
        await page.evaluate(() => localStorage.getItem('roomdev:slot:1')!),
      ),
    ).save.game;
    await Promise.all([page.waitForEvent('load'), update.click()]);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '第 2 天',
    );
    await expect(update).toHaveCount(0);
    await expect(page.locator('meta[name="fixture-version"]')).toHaveAttribute(
      'content',
      '2',
    );
    const after = decodeStored(
      JSON.parse(
        await page.evaluate(() => localStorage.getItem('roomdev:slot:1')!),
      ),
    ).save.game;
    expect(after.characters).toEqual(before.characters);
    expect(after.legacy).toEqual(before.legacy);
    const names = await page.evaluate(() => caches.keys());
    expect(names).toContain('foreign-fixture');
    expect(names.some((name) => name.includes('fixture-v1-'))).toBe(false);
    expect(names.some((name) => name.includes('fixture-v2-'))).toBe(true);
  } finally {
    await site.close();
  }
});

test('M7 another open tab keeps access to its previous lazy chunks after an application upgrade', async ({
  page,
  context,
  baseURL,
}) => {
  const site = await fixture(new URL(baseURL!).pathname);
  try {
    await page.addInitScript(
      (raw) => {
        if (!localStorage.getItem('roomdev:slot:1'))
          localStorage.setItem('roomdev:slot:1', raw);
      },
      exportArchive(createGame(Date.now())),
    );
    await page.goto(site.url + '#/room');
    await expect(
      page.getByRole('complementary', { name: '离线与更新' }),
    ).toContainText('已准备好离线使用');
    const moduleUrl = site.url + 'assets/previous-generation.js';
    await page.evaluate(
      async ({ source, oldModule }) => {
        localStorage.setItem('roomdev:slot:2', source);
        const name = (await caches.keys()).find((key) =>
          key.includes('fixture-v1-'),
        )!;
        await (
          await caches.open(name)
        ).put(
          oldModule,
          new Response('export const previousGeneration = 42;', {
            headers: { 'Content-Type': 'text/javascript' },
          }),
        );
      },
      {
        source: exportArchive({ ...createGame(Date.now()), slotId: 'slot-2' }),
        oldModule: moduleUrl,
      },
    );
    const other = await context.newPage();
    await other.addInitScript(() => {
      sessionStorage.setItem('roomdev:active-slot', 'slot-2');
      Object.assign(window, { __unchangedPage: true });
    });
    await other.goto(site.url + '#/room');
    await expect(
      other.getByRole('complementary', { name: '离线与更新' }),
    ).toContainText('已准备好离线使用');
    site.update();
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    const update = page.getByRole('button', {
      name: '保存并更新应用',
      exact: true,
    });
    await expect(update).toBeVisible();
    await Promise.all([page.waitForEvent('load'), update.click()]);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '第 1 天',
    );
    expect(
      await other.evaluate(
        () =>
          (window as unknown as { __unchangedPage: boolean }).__unchangedPage,
      ),
    ).toBe(true);
    expect(
      await other.evaluate(
        async (url) => (await import(url)).previousGeneration,
        moduleUrl,
      ),
    ).toBe(42);
    expect(
      (await other.evaluate(() => caches.keys())).some((name) =>
        name.includes('fixture-v1-'),
      ),
    ).toBe(true);
    await other.getByRole('button', { name: /进入下一天/u }).click();
    await expect(other.getByRole('heading', { level: 1 })).toContainText(
      '第 2 天',
    );
  } finally {
    await site.close();
  }
});

test('M7 failed precaching is reported honestly while the online game remains usable', async ({
  page,
  baseURL,
}) => {
  const site = await fixture(new URL(baseURL!).pathname, true);
  try {
    await page.addInitScript(
      (raw) => localStorage.setItem('roomdev:slot:1', raw),
      exportArchive(createGame(Date.now())),
    );
    await page.goto(site.url + '#/room');
    await expect(
      page.getByRole('complementary', { name: '离线与更新' }),
    ).toContainText('离线准备未完成');
    await page.getByRole('button', { name: /进入下一天/u }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '第 2 天',
    );
    await expect(
      page.getByText('✓ 已保存到此浏览器', { exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => caches.keys())).filter((name) =>
        name.startsWith('roomie-offline:'),
      ),
    ).toEqual([]);
  } finally {
    await site.close();
  }
});
