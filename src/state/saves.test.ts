import { beforeEach, describe, expect, it } from 'vitest';
import { GAME, SAVES } from '../data/constants';
import { createGame, createBeds } from '../domain/initial';
import {
  exportArchive,
  previewImport,
  readImportFile,
  slotKey,
  type SlotId,
} from '../domain/saves';
import { createGameStore, loadGame, type GameStorage } from './game';
import type { SlotCommand } from './slotCommands';
import { oldM3Game } from '../test/oldSave';
import { queuedEvent } from '../test/eventGame';
import { changeWardrobe } from '../domain/wardrobe';
import { settleDay } from '../domain/rules';
import type { GameState } from '../domain/model';

function fixture(
  storage: GameStorage,
  slot: SlotId = 'slot-1',
  game = createGame(1000),
) {
  const raw = exportArchive({ ...game, slotId: slot });
  storage.setItem(slotKey(slot), raw);
  return raw;
}
function store(
  storage: GameStorage = localStorage,
  selection?: GameStorage,
  now = 1000,
  locks?: Pick<LockManager, 'request'>,
) {
  return createGameStore(
    storage,
    () => now,
    () => false,
    () => true,
    locks,
    selection,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('M5 five isolated slots', () => {
  it('keeps the existing key and creates at most five fresh stories without replacing an occupied slot', async () => {
    const raw = fixture(localStorage);
    const game = store();
    expect(game.getState().slots).toHaveLength(5);
    expect(slotKey('slot-1')).toBe(GAME.storageKey);
    for (const id of SAVES.slots.slice(1)) {
      const result = await game.getState().manageSlot({
        type: 'create',
        slotId: id,
        expectedRaw: null,
        name: `回忆 ${id}`,
      });
      expect(result.error).toBeUndefined();
      expect(game.getState().activeSlot).toBe(id);
      expect(game.getState().game.characters).toEqual([]);
      expect(game.getState().game.day).toBe(1);
    }
    expect(game.getState().slots.every((slot) => !slot.empty)).toBe(true);
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    const occupied = await game.getState().manageSlot({
      type: 'create',
      slotId: 'slot-1',
      expectedRaw: raw,
      name: '覆盖尝试',
    });
    expect(occupied.error).toBeTruthy();
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    expect(
      (
        await game.getState().manageSlot({
          type: 'switch',
          slotId: 'slot-6',
        } as unknown as SlotCommand)
      ).error,
    ).toBeTruthy();
  });
  it('persists selection per tab and preserves distinct residents, outfits, counters, days and seeds', async () => {
    fixture(localStorage);
    const other = createGame(1000);
    other.characters[0]!.name = '桃桃';
    other.randomSeed = 123;
    fixture(localStorage, 'slot-2', other);
    const first = store(localStorage, sessionStorage);
    first.getState().next(1);
    const slotOne = first.getState().game;
    await first.getState().manageSlot({ type: 'switch', slotId: 'slot-2' });
    expect(first.getState().game.characters[0]!.name).toBe('桃桃');
    await first.getState().interact({
      operationId: 'talk-second',
      expectedDay: 1,
      characterId: 'resident-1',
      kind: 'normal',
      actionId: 'talk',
    });
    const restored = store(localStorage, sessionStorage);
    expect(restored.getState().activeSlot).toBe('slot-2');
    expect(restored.getState().game.characters[0]!.daily.interactions).toBe(1);
    expect(store().getState().activeSlot).toBe('slot-1');
    await restored.getState().manageSlot({ type: 'switch', slotId: 'slot-1' });
    expect(restored.getState().game).toEqual(slotOne);
    expect(loadGame(localStorage, 1000, false, 'slot-2').game.randomSeed).toBe(
      123,
    );
  });
  it('renames only the selected slot and rejects unsafe, empty and oversized names', async () => {
    fixture(localStorage);
    const secondRaw = fixture(localStorage, 'slot-2');
    const game = store();
    const result = await game.getState().manageSlot({
      type: 'rename',
      slotId: 'slot-2',
      expectedRaw: secondRaw,
      name: '樱桃日记',
    });
    expect(result.error).toBeUndefined();
    expect(game.getState().activeSlot).toBe('slot-1');
    expect(game.getState().slots[1]!.game.name).toBe('樱桃日记');
    const original = localStorage.getItem(GAME.storageKey);
    for (const name of ['', '小学生寝室', 'a'.repeat(41)])
      expect(
        (
          await game.getState().manageSlot({
            type: 'rename',
            slotId: 'slot-1',
            expectedRaw: original,
            name,
          })
        ).error,
      ).toBeTruthy();
    expect(localStorage.getItem(GAME.storageKey)).toBe(original);
  });
  it('requires confirmation for deletion, leaves other slots intact and prevents old tabs resurrecting deleted data', async () => {
    const raw = fixture(localStorage);
    const second = fixture(localStorage, 'slot-2');
    const current = store();
    const stale = store();
    expect(
      (
        await current.getState().manageSlot({
          type: 'delete',
          slotId: 'slot-1',
          expectedRaw: raw,
        } as SlotCommand)
      ).error,
    ).toBeTruthy();
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    expect(
      (
        await current.getState().manageSlot({
          type: 'delete',
          slotId: 'slot-1',
          expectedRaw: raw,
          confirmed: true,
        })
      ).error,
    ).toBeUndefined();
    const deleted = localStorage.getItem(GAME.storageKey);
    expect(JSON.parse(deleted!).deleted).toBe(true);
    expect(current.getState().empty).toBe(true);
    current.getState().tick();
    expect(localStorage.getItem(GAME.storageKey)).toBe(deleted);
    stale.getState().next(1);
    expect(stale.getState().status).toBe('conflict');
    expect(localStorage.getItem(GAME.storageKey)).toBe(deleted);
    expect(localStorage.getItem(slotKey('slot-2'))).toBe(second);
    expect(
      (
        await current.getState().manageSlot({
          type: 'create',
          slotId: 'slot-1',
          expectedRaw: deleted,
          name: '再写一页',
        })
      ).error,
    ).toBeUndefined();
    expect(current.getState().game.day).toBe(1);
    expect(current.getState().game.characters).toEqual([]);
  });
  it('applies catchup only to the selected archive and never resets another slot clock', async () => {
    fixture(localStorage);
    const second = fixture(localStorage, 'slot-2');
    const game = store(
      localStorage,
      undefined,
      1000 + 10 * GAME.normalInterval,
    );
    game.getState().initialize();
    expect(game.getState().game.day).toBe(8);
    expect(localStorage.getItem(slotKey('slot-2'))).toBe(second);
    await game.getState().manageSlot({ type: 'switch', slotId: 'slot-2' });
    expect(game.getState().game.day).toBe(8);
    expect(game.getState().notice).toContain('3 天已舍弃');
    expect(loadGame(localStorage, 1000, false).game.day).toBe(8);
  });
  it('does not conflict on writes to another slot but blocks stale same-slot writes', async () => {
    fixture(localStorage);
    fixture(localStorage, 'slot-2');
    const a = store();
    const b = store();
    await b.getState().manageSlot({ type: 'switch', slotId: 'slot-2' });
    a.getState().detectConflict();
    expect(a.getState().status).toBe('ready');
    b.getState().next(1);
    a.getState().next(1);
    expect(a.getState().status).toBe('ready');
    const stale = store();
    a.getState().next(2);
    stale.getState().next(2);
    expect(stale.getState().status).toBe('conflict');
  });
  it('rejects pending old-screen commands after a queued slot switch', async () => {
    fixture(localStorage);
    fixture(localStorage, 'slot-2');
    const tasks: Array<() => void> = [];
    const request = <T>(_name: string, callback: LockGrantedCallback<T>) =>
      new Promise<T>((resolve) => {
        tasks.push(() => resolve(callback(null)));
      });
    const locks = { request } as Pick<LockManager, 'request'>;
    const game = store(localStorage, undefined, 1000, locks);
    const switched = game
      .getState()
      .manageSlot({ type: 'switch', slotId: 'slot-2' });
    const action = game.getState().interact({
      operationId: 'old-screen',
      expectedDay: 1,
      characterId: 'resident-1',
      kind: 'normal',
      actionId: 'talk',
    });
    game.getState().move('resident-1', 'room-101-bed-2');
    tasks.shift()!();
    await switched;
    tasks.shift()!();
    expect((await action).error).toBeTruthy();
    tasks.shift()!();
    expect(game.getState().game.characters[0]!.daily.interactions).toBe(0);
    expect(game.getState().game.characters[0]!.bedId).toBe('room-101-bed-1');
  });
});

describe('M5 validated imports and migrations', () => {
  it('preserves an old UTF-8 BOM source exactly and rejects invalid UTF-8 instead of replacing characters', async () => {
    const source =
      '\uFEFF' +
      JSON.stringify(
        { revision: 1, commitId: 'bom-old', game: oldM3Game(createGame(1000)) },
        null,
        2,
      );
    const bytes = new TextEncoder().encode(source);
    const preview = await readImportFile({
      size: bytes.byteLength,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    });
    expect(preview.raw).toBe(source);
    expect(preview.sourceRaw).toBe(source);
    localStorage.setItem(GAME.storageKey, source);
    const game = store();
    game.getState().initialize();
    expect(game.getState().status).toBe('ready');
    expect((await store().getState().exportSlot('slot-1', true)).raw).toBe(
      source,
    );
    await expect(
      readImportFile({
        size: 3,
        arrayBuffer: async () => Uint8Array.from([123, 255, 125]).buffer,
      }),
    ).rejects.toThrow(/UTF-8/u);
  });
  it('roundtrips a full eight-resident archive with 300 logs and growth records within the file limit', () => {
    let game = createGame(1000);
    const room = game.rooms[0]!;
    room.capacity = 8;
    room.beds = createBeds(room.id, 8, 'loft');
    game.characters.push(
      ...game.characters.map((character, index) => ({
        ...structuredClone(character),
        id: `extra-${index}`,
        bedId: room.beds[index + 4]!.id,
      })),
    );
    for (let day = 1; day <= 305; day++) game = settleDay(game, day, 'manual');
    const raw = exportArchive(game);
    expect(game.logs).toHaveLength(300);
    expect(
      game.characters.every((character) => character.growth.length === 300),
    ).toBe(true);
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThanOrEqual(
      SAVES.maxImportBytes,
    );
    expect(previewImport(raw).game).toEqual(game);
  });
  it('exports and restores complete character, wardrobe, pending event and progression data to another slot', async () => {
    let original = queuedEvent();
    original = changeWardrobe(original, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '粉色记忆',
    }).game;
    fixture(localStorage, 'slot-1', original);
    const game = store();
    const exported = await game.getState().exportSlot('slot-1');
    expect(exported.error).toBeUndefined();
    expect(exported.filename).toContain('slot-1');
    const preview = previewImport(exported.raw!);
    expect(preview.game).toEqual(original);
    expect(
      (
        await game.getState().manageSlot({
          type: 'import',
          slotId: 'slot-2',
          expectedRaw: null,
          raw: exported.raw!,
          confirmed: true,
        })
      ).error,
    ).toBeUndefined();
    const restored = loadGame(localStorage, 1000, false, 'slot-2').game;
    expect(restored).toEqual({ ...original, slotId: 'slot-2' });
    expect(game.getState().activeSlot).toBe('slot-1');
    const fresh = store();
    expect(
      (await fresh.getState().exportSlot('slot-2')).raw &&
        previewImport((await fresh.getState().exportSlot('slot-2')).raw!).game,
    ).toEqual(restored);
  });
  it('validates root shape, all limits, adulthood and references before replacing anything', async () => {
    const existing = fixture(localStorage);
    const game = store();
    const variants: unknown[] = [
      null,
      [],
      {},
      { revision: 0, commitId: 'future', game: { version: '9.0' } },
    ];
    const mutations = [
      (g: GameState) => {
        g.characters[0]!.age = 17;
      },
      (g: GameState) => {
        g.characters[0]!.name = '幼儿园学生';
      },
      (g: GameState) => {
        g.characters[0]!.name = 'a'.repeat(41);
      },
      (g: GameState) => {
        g.characters[1]!.id = g.characters[0]!.id;
      },
      (g: GameState) => {
        g.characters[1]!.bedId = g.characters[0]!.bedId;
      },
      (g: GameState) => {
        g.characters[0]!.roomId = 'missing';
      },
      (g: GameState) => {
        g.characters[0]!.bedId = 'missing';
      },
      (g: GameState) => {
        g.characters[0]!.stats.progress = 101;
      },
      (g: GameState) => {
        g.characters[0]!.stats.energy = 1.5;
      },
      (g: GameState) => {
        g.characters[0]!.outfit.top = 'unknown-shirt';
      },
      (g: GameState) => {
        g.rooms[0]!.facilities.dryWet = true;
      },
      (g: GameState) => {
        g.characters.push(
          ...Array.from({ length: 25 }, () =>
            structuredClone(g.characters[0]!),
          ),
        );
      },
      (g: GameState) => {
        g.rooms.push(
          ...Array.from({ length: 6 }, () => structuredClone(g.rooms[0]!)),
        );
      },
      (g: GameState) => {
        g.clock.lastObserved = g.clock.anchor - 1;
      },
      (g: GameState) => {
        g.characters = [];
      },
    ];
    for (const mutate of mutations) {
      const g = createGame(1000);
      mutate(g);
      variants.push({ revision: 1, commitId: 'bad', game: g });
    }
    for (const value of variants) {
      const raw = JSON.stringify(value);
      expect(() => previewImport(raw)).toThrow();
      expect(
        (
          await game.getState().manageSlot({
            type: 'import',
            slotId: 'slot-1',
            expectedRaw: existing,
            raw,
            confirmed: true,
          })
        ).error,
      ).toBeTruthy();
      expect(localStorage.getItem(GAME.storageKey)).toBe(existing);
      expect(game.getState().game).toEqual(createGame(1000));
    }
  });
  it('rejects malformed JSON, unknown fields and byte oversized UTF-8 before any write', () => {
    expect(() => previewImport('{broken')).toThrow(/JSON/u);
    expect(() =>
      previewImport(
        JSON.stringify({
          ...JSON.parse(exportArchive(createGame(1000))),
          surprise: true,
        }),
      ),
    ).toThrow();
    expect(() => previewImport(' '.repeat(SAVES.maxImportBytes + 1))).toThrow(
      /2 MiB/u,
    );
    expect(() =>
      previewImport('粉'.repeat(Math.ceil(SAVES.maxImportBytes / 3))),
    ).toThrow(/2 MiB/u);
    const exact = exportArchive(createGame(1000));
    expect(
      previewImport(
        exact +
          ' '.repeat(
            SAVES.maxImportBytes - new TextEncoder().encode(exact).byteLength,
          ),
      ).game.day,
    ).toBe(1);
  });
  it('requires confirmation, refuses stale preview targets and rejects an invalid slot even for a valid file', async () => {
    const raw = fixture(localStorage);
    const game = store();
    const backup = exportArchive(createGame(1000));
    const command = {
      type: 'import',
      slotId: 'slot-1',
      expectedRaw: raw,
      raw: backup,
      confirmed: true,
    } as const;
    expect(
      (
        await game.getState().manageSlot({
          ...command,
          confirmed: false,
        } as unknown as SlotCommand)
      ).error,
    ).toBeTruthy();
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    const other = store();
    other.getState().next(1);
    const latest = localStorage.getItem(GAME.storageKey);
    expect((await game.getState().manageSlot(command)).error).toContain(
      '预览后已变化',
    );
    expect(localStorage.getItem(GAME.storageKey)).toBe(latest);
    expect(
      (
        await game.getState().manageSlot({
          ...command,
          slotId: 'slot-6',
        } as unknown as SlotCommand)
      ).error,
    ).toBeTruthy();
  });
  it('retains original old archive bytes across automatic migration, refresh and explicit import', async () => {
    const old = {
      revision: 4,
      commitId: 'old-original',
      game: oldM3Game(settleDay(createGame(1000), 1, 'manual')),
    };
    const raw = JSON.stringify(old, null, 2);
    localStorage.setItem(GAME.storageKey, raw);
    const game = store();
    game.getState().initialize();
    expect(game.getState().game.version).toBe('1.6');
    expect((await game.getState().exportSlot('slot-1', true)).raw).toBe(raw);
    game.getState().next(2);
    const fresh = store();
    expect((await fresh.getState().exportSlot('slot-1', true)).raw).toBe(raw);
    expect(
      (
        await fresh.getState().manageSlot({
          type: 'import',
          slotId: 'slot-2',
          expectedRaw: null,
          raw,
          confirmed: true,
        })
      ).error,
    ).toBeUndefined();
    expect((await store().getState().exportSlot('slot-2', true)).raw).toBe(raw);
    expect(
      loadGame(localStorage, 1000, false, 'slot-2').game.characters[0]!
        .appearance,
    ).toEqual({ ...old.game.characters[0]!.appearance, face: 'gentle' });
  });
  it('protects broken and future archives and allows explicit confirmed recovery into their slot', async () => {
    for (const raw of [
      '{broken-original',
      JSON.stringify({
        revision: 4,
        commitId: 'future',
        game: { version: '99.0' },
      }),
    ]) {
      localStorage.setItem(GAME.storageKey, raw);
      const game = store();
      game.getState().initialize();
      expect(game.getState().status).toBe('invalid');
      expect((await game.getState().exportSlot('slot-1', true)).raw).toBe(raw);
      game.getState().next(1);
      expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
      const restored = await game.getState().manageSlot({
        type: 'import',
        slotId: 'slot-1',
        expectedRaw: raw,
        raw: exportArchive(createGame(1000)),
        confirmed: true,
      });
      expect(restored.error).toBeUndefined();
      expect(game.getState().status).toBe('ready');
      expect(game.getState().game.characters).toHaveLength(4);
    }
  });
  it('rebuilds the import clock without extra rewards and preserves day, randomness and pending decisions', async () => {
    const original = queuedEvent();
    fixture(localStorage);
    const game = store(
      localStorage,
      undefined,
      1000 + 100 * GAME.normalInterval,
    );
    const result = await game.getState().manageSlot({
      type: 'import',
      slotId: 'slot-2',
      expectedRaw: null,
      raw: exportArchive(original),
      confirmed: true,
    });
    expect(result.error).toBeUndefined();
    const restored = loadGame(localStorage, 1000, false, 'slot-2').game;
    expect(restored.day).toBe(original.day);
    expect(restored.randomSeed).toBe(original.randomSeed);
    expect(restored.pendingEvents).toEqual(original.pendingEvents);
    expect(restored.wallet).toEqual(original.wallet);
    expect(restored.clock.anchor).toBe(1000 + 100 * GAME.normalInterval);
  });
});

describe('M5 storage failure recovery', () => {
  it.each(['import', 'delete', 'create', 'rename'] as const)(
    'leaves the effective archive unchanged when %s cannot be persisted',
    async (type) => {
      const raw = fixture(localStorage);
      let failing = false;
      const storage: GameStorage = {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          if (failing) throw new DOMException('full', 'QuotaExceededError');
          localStorage.setItem(key, value);
        },
      };
      const game = store(storage);
      failing = true;
      const command =
        type === 'import'
          ? {
              type,
              slotId: 'slot-1',
              expectedRaw: raw,
              raw: exportArchive(createGame(1000)),
              confirmed: true,
            }
          : type === 'delete'
            ? { type, slotId: 'slot-1', expectedRaw: raw, confirmed: true }
            : type === 'create'
              ? { type, slotId: 'slot-2', expectedRaw: null, name: '新故事' }
              : { type, slotId: 'slot-1', expectedRaw: raw, name: '新名称' };
      expect(
        (await game.getState().manageSlot(command as SlotCommand)).error,
      ).toBeTruthy();
      expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
      expect(localStorage.getItem(slotKey('slot-2'))).toBeNull();
      expect(game.getState().activeSlot).toBe('slot-1');
    },
  );
  it('keeps unsaved memory progress exportable, blocks switching until saved and succeeds after retry', async () => {
    fixture(localStorage);
    fixture(localStorage, 'slot-2');
    let failing = false;
    const storage: GameStorage = {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        if (failing) throw new DOMException('full', 'QuotaExceededError');
        localStorage.setItem(key, value);
      },
    };
    const game = store(storage);
    failing = true;
    game.getState().next(1);
    expect(game.getState().status).toBe('unavailable');
    expect(game.getState().game.day).toBe(2);
    expect(
      (await game.getState().manageSlot({ type: 'switch', slotId: 'slot-2' }))
        .error,
    ).toBeTruthy();
    expect(game.getState().activeSlot).toBe('slot-1');
    expect(
      previewImport((await game.getState().exportSlot('slot-1')).raw!).game.day,
    ).toBe(2);
    failing = false;
    expect((await game.getState().retrySave()).error).toBeUndefined();
    expect(game.getState().dirty).toBe(false);
    expect(
      (await game.getState().manageSlot({ type: 'switch', slotId: 'slot-2' }))
        .error,
    ).toBeUndefined();
    expect(loadGame(localStorage, 1000, false).game.day).toBe(2);
  });
  it('does not mutate a migration source when writing its upgraded record fails', () => {
    const raw = JSON.stringify({
      revision: 1,
      commitId: 'old',
      game: oldM3Game(createGame(1000)),
    });
    localStorage.setItem(GAME.storageKey, raw);
    const storage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    const game = store(storage, undefined, 1001);
    game.getState().initialize();
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    expect(game.getState().sourceRaw).toBe(raw);
    expect(game.getState().status).toBe('unavailable');
  });
  it('handles denied local and session storage without overwriting anything', async () => {
    const denied = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    const game = store(denied, denied);
    expect(game.getState().status).toBe('unavailable');
    expect(
      (
        await game.getState().manageSlot({
          type: 'create',
          slotId: 'slot-2',
          expectedRaw: null,
          name: '故事',
        })
      ).error,
    ).toBeTruthy();
    fixture(localStorage);
    fixture(localStorage, 'slot-2');
    const selected = store(localStorage, denied);
    expect(
      (
        await selected
          .getState()
          .manageSlot({ type: 'switch', slotId: 'slot-2' })
      ).error,
    ).toBeUndefined();
    expect(selected.getState().notice).toContain('无法记住');
  });
});
