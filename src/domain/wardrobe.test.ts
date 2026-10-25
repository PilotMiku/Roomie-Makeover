import { oldM3Game } from '../test/oldSave';
import { describe, expect, it } from 'vitest';
import {
  CLOTHES,
  FIRST_LOOK_EVENT,
  OPEN_SLOTS,
  DEFAULT_BOTTOM_COLOR,
} from '../data/clothes';
import { createGame } from './initial';
import { changeWardrobe, type WardrobeCommand } from './wardrobe';
import { conditionMet, syncWardrobeUnlocks } from './unlocks';
import { changeStats, settleDay } from './rules';
import { gameSchema, type GameState } from './model';
import {
  portraitLayers,
  avatarPixels,
  avatarSignature,
} from '../render/pixels';
import { decodeSave } from './migrations';
import { GAME } from '../data/constants';
import { createGameStore, loadGame } from '../state/game';

function dress(game: GameState, command: WardrobeCommand) {
  const result = changeWardrobe(game, command);
  expect(result.error).toBeUndefined();
  expect(gameSchema.safeParse(result.game).success).toBe(true);
  return result.game;
}
describe('catalog and actual pixel layers', () => {
  it('has 32 local clothes across six slots, covering all four styles', () => {
    expect(CLOTHES).toHaveLength(32);
    expect(new Set(CLOTHES.map((item) => item.id)).size).toBe(32);
    for (const slot of OPEN_SLOTS)
      expect(
        CLOTHES.filter((item) => item.slot === slot).length,
      ).toBeGreaterThanOrEqual(
        ['hair', 'top', 'bottom'].includes(slot) ? 8 : 2,
      );
    expect(new Set(CLOTHES.map((item) => item.style)).size).toBe(4);
  });
  it('draws a distinct pixel shape for every item and preserves unrelated layers', () => {
    const character = createGame(1000).characters[0]!;
    const original = portraitLayers(character);
    for (const slot of OPEN_SLOTS) {
      const signatures = CLOTHES.filter((item) => item.slot === slot).map(
        (item) => {
          const updated = {
            ...character,
            outfit: { ...character.outfit, [slot]: item.id },
          };
          const layers = portraitLayers(updated);
          for (const other of OPEN_SLOTS)
            if (other !== slot && !(slot === 'skirt' && other === 'bottom'))
              expect(layers[other]).toEqual(original[other]);
          return JSON.stringify(layers[slot]);
        },
      );
      expect(new Set(signatures).size).toBe(
        CLOTHES.filter((item) => item.slot === slot).length,
      );
    }
  });
  it('updates avatar pixels and its cache signature when hair, top or colors change', () => {
    const character = createGame(1000).characters[0]!;
    for (const changed of [
      { ...character, outfit: { ...character.outfit, hair: 'ribbon-tails' } },
      { ...character, outfit: { ...character.outfit, top: 'duck-shirt' } },
      {
        ...character,
        appearance: { ...character.appearance, hairColor: '#ff88bb' },
      },
    ]) {
      expect(avatarSignature(changed)).not.toBe(avatarSignature(character));
      expect(avatarPixels(changed)).not.toEqual(avatarPixels(character));
    }
    const bottomChanged = {
      ...character,
      appearance: { ...character.appearance, bottomColor: '#ff88bb' },
    };
    expect(portraitLayers(bottomChanged).bottom).not.toEqual(
      portraitLayers(character).bottom,
    );
  });
});
describe('unlock settlement', () => {
  it('respects exact growth/affection thresholds and never relocks or grants twice', () => {
    let game = createGame(1000);
    game.characters[0]!.stats.progress = 14;
    game.characters[0]!.stats.affection = 49;
    expect(syncWardrobeUnlocks(game)).toBe(game);
    game.characters[0] = changeStats(
      game.characters[0]!,
      { progress: 1, affection: 1 },
      1,
    );
    game = syncWardrobeUnlocks(game);
    expect(game.wardrobe.unlockedIds).toContain('cloud-waves');
    expect(game.wardrobe.unlockedIds).toContain('star-shirt');
    const count = game.logs.filter(
      (log) => log.type === 'wardrobe' && log.action === 'unlock',
    ).length;
    game.characters[0]!.stats.progress = 0;
    game.characters[0]!.stats.affection = 0;
    expect(syncWardrobeUnlocks(game)).toBe(game);
    expect(game.wardrobe.unlockedIds).toContain('cloud-waves');
    expect(
      game.logs.filter(
        (log) => log.type === 'wardrobe' && log.action === 'unlock',
      ),
    ).toHaveLength(count);
  });
  it('unlocks from the same natural day settlement, without UI side effects', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.progress = 12;
    const next = settleDay(game, 1, 'manual');
    expect(next.wardrobe.unlockedIds).toContain('moon-tunic');
    expect(next.characters[0]!.stats.progress).toBe(15);
    expect(game.wardrobe.unlockedIds).not.toContain('moon-tunic');
  });
  it('fires the first-preset event exactly once even after deleting and saving again', () => {
    let game = createGame(1000);
    const stats = game.characters.map((character) => character.stats);
    game = dress(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '第一套造型',
    });
    expect(game.resolvedEventIds).toContain(FIRST_LOOK_EVENT);
    expect(game.wardrobe.unlockedIds).toContain('cream-buns');
    expect(game.wardrobe.unlockedIds).toContain('duck-stripes');
    game = dress(game, {
      type: 'delete-preset',
      presetId: game.wardrobe.presets[0]!.id,
    });
    game = dress(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '再收藏',
    });
    expect(
      game.resolvedEventIds.filter((id) => id === FIRST_LOOK_EVENT),
    ).toHaveLength(1);
    expect(
      game.logs.filter(
        (log) => log.type === 'wardrobe' && log.action === 'unlock',
      ),
    ).toHaveLength(1);
    expect(game.characters.map((character) => character.stats)).toEqual(stats);
  });
  it('makes every catalog item reachable and reserves achievement conditions for future eggs', () => {
    let game = createGame(1000);
    game.characters[0]!.stats.progress = 100;
    game.characters[0]!.stats.affection = 100;
    game.resolvedEventIds.push(FIRST_LOOK_EVENT);
    game = syncWardrobeUnlocks(game);
    expect(game.wardrobe.unlockedIds).toHaveLength(CLOTHES.length);
    expect(
      conditionMet(game, { type: 'achievement', achievementId: 'egg' }),
    ).toBe(false);
    game.legacy.achievements.push('egg');
    expect(
      conditionMet(game, { type: 'achievement', achievementId: 'egg' }),
    ).toBe(true);
  });
});
describe('wardrobe rules and presets', () => {
  it.each([
    {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'hair',
      itemId: 'cloud-waves',
    },
    {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'hair',
      itemId: 'basic-top',
    },
    {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'shoes',
      itemId: 'basic-top',
    },
    {
      type: 'equip',
      characterId: 'missing',
      slot: 'hair',
      itemId: 'ribbon-tails',
    },
    {
      type: 'color',
      characterId: 'resident-1',
      colors: { hairColor: 'red', topColor: '#ffffff', bottomColor: '#ffffff' },
    },
  ])(
    'rejects locked, invalid or unopened operations atomically: %j',
    (command) => {
      const game = createGame(1000);
      const result = changeWardrobe(game, command);
      expect(result.error).toBeTruthy();
      expect(result.game).toBe(game);
    },
  );
  it('captures and applies all three clothes and colors without replacing skin, stats or bindings', () => {
    let game = createGame(1000);
    game = dress(game, {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'hair',
      itemId: 'ribbon-tails',
    });
    game = dress(game, {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'top',
      itemId: 'duck-shirt',
    });
    game = dress(game, {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'bottom',
      itemId: 'ribbon-shorts',
    });
    game = dress(game, {
      type: 'color',
      characterId: 'resident-1',
      colors: {
        hairColor: '#775588',
        topColor: '#ffaaee',
        bottomColor: '#ff88bb',
      },
    });
    game = dress(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '  樱桃奶油  ',
    });
    const before = game.characters[1]!;
    const preset = game.wardrobe.presets[0]!;
    expect(preset.name).toBe('樱桃奶油');
    game = dress(game, {
      type: 'apply-preset',
      characterId: before.id,
      presetId: preset.id,
    });
    expect(game.characters[1]!.outfit).toEqual(preset.outfit);
    expect(game.characters[1]!.appearance.bottomColor).toBe('#ff88bb');
    expect(game.characters[1]!.appearance.skinColor).toBe(
      before.appearance.skinColor,
    );
    expect(game.characters[1]!.stats).toEqual(before.stats);
    expect(game.characters[1]!.bedId).toBe(before.bedId);
    const worn = game.characters[1]!.outfit;
    game = dress(game, { type: 'delete-preset', presetId: preset.id });
    expect(game.characters[1]!.outfit).toEqual(worn);
    expect(game.wardrobe.presets).toHaveLength(0);
  });
  it('uses reproducible random choices within unlocked items and does not change growth', () => {
    const original = createGame(1000);
    const first = dress(original, {
      type: 'random',
      characterId: 'resident-1',
    });
    const repeated = dress(original, {
      type: 'random',
      characterId: 'resident-1',
    });
    expect(first.characters[0]!.outfit).toEqual(repeated.characters[0]!.outfit);
    expect(first.randomSeed).toBe(repeated.randomSeed);
    let game = first;
    for (let count = 0; count < 50; count++) {
      game = dress(game, { type: 'random', characterId: 'resident-1' });
      for (const slot of OPEN_SLOTS)
        if (game.characters[0]!.outfit[slot] !== null)
          expect(game.wardrobe.unlockedIds).toContain(
            game.characters[0]!.outfit[slot],
          );
        else expect(['skirt', 'accessory', 'makeup']).toContain(slot);
      expect(game.characters[0]!.stats).toEqual(original.characters[0]!.stats);
    }
  });
  it('enforces preset names, limits, stale deletion and readonly identities', () => {
    const game = createGame(1000);
    for (const name of ['', 'x'.repeat(41), '17岁的造型'])
      expect(
        changeWardrobe(game, {
          type: 'save-preset',
          characterId: 'resident-1',
          name,
        }).error,
      ).toBeTruthy();
    const full = dress(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '收藏',
    });
    const preset = full.wardrobe.presets[0]!;
    full.wardrobe.presets = Array.from({ length: 50 }, (_, index) => ({
      ...preset,
      id: `preset-${index}`,
    }));
    expect(
      changeWardrobe(full, {
        type: 'save-preset',
        characterId: 'resident-1',
        name: '超限',
      }).game,
    ).toBe(full);
    expect(
      changeWardrobe(game, { type: 'delete-preset', presetId: 'missing' }).game,
    ).toBe(game);
    for (const identity of [
      'observer',
      'parent',
      'warden',
      'manager',
      'counselor',
    ] as const) {
      const readonly = { ...game, player: { ...game.player, identity } };
      expect(
        changeWardrobe(readonly, { type: 'random', characterId: 'resident-1' })
          .game,
      ).toBe(readonly);
    }
  });
  it('rejects malformed equipped references and future-slot data at save validation', () => {
    for (const mutate of [
      (game: GameState) => {
        game.characters[0]!.outfit.hair = 'nonexistent';
      },
      (game: GameState) => {
        game.characters[0]!.outfit.hair = 'cloud-waves';
      },
      (game: GameState) => {
        game.characters[0]!.outfit.shoes = 'pretend-shoes';
      },
      (game: GameState) => {
        game.wardrobe.unlockedIds.push('basic-top');
      },
    ]) {
      const game = createGame(1000);
      mutate(game);
      expect(gameSchema.safeParse(game).success).toBe(false);
    }
  });
});
describe('M3 persistence and M2 migration', () => {
  it('preserves 1.1 appearances and progress while introducing bottom color and preset palettes', () => {
    const current = oldM3Game(createGame(1000));
    const old = {
      revision: 2,
      commitId: 'm2',
      game: {
        ...current,
        version: '1.1',
        characters: current.characters.map((character) => {
          const { bottomColor, ...appearance } = character.appearance;
          void bottomColor;
          return { ...character, appearance };
        }),
        wardrobe: {
          ...current.wardrobe,
          presets: [
            {
              id: 'old-preset',
              name: '旧搭配',
              outfit: current.characters[0]!.outfit,
            },
          ],
        },
      },
    };
    const raw = JSON.stringify(old);
    const migrated = decodeSave(old);
    expect(migrated.game.version).toBe('1.6');
    expect(JSON.stringify(old)).toBe(raw);
    expect(migrated.game.characters[0]!.appearance.hairColor).toBe(
      current.characters[0]!.appearance.hairColor,
    );
    expect(migrated.game.characters[0]!.appearance.bottomColor).toBe(
      DEFAULT_BOTTOM_COLOR,
    );
    expect(migrated.game.characters[0]!.stats).toEqual(
      current.characters[0]!.stats,
    );
    expect(migrated.game.wardrobe.presets[0]!.name).toBe('旧搭配');
    expect(migrated.game.wardrobe.presets[0]!.colors).toBeDefined();
  });
  it('restores outfits, palettes, presets and event unlocks across independent stores', async () => {
    localStorage.clear();
    localStorage.setItem(
      GAME.storageKey,
      JSON.stringify({
        revision: 1,
        commitId: 'fixture',
        game: createGame(1000),
      }),
    );
    const store = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    await store.getState().dress({
      type: 'equip',
      characterId: 'resident-1',
      slot: 'top',
      itemId: 'duck-shirt',
    });
    await store.getState().dress({
      type: 'save-preset',
      characterId: 'resident-1',
      name: '小鸭日常',
    });
    expect(loadGame(localStorage, 1000, false).game).toEqual(
      store.getState().game,
    );
    expect(
      loadGame(localStorage, 1000, false).game.wardrobe.unlockedIds,
    ).toContain('cream-buns');
  });
  it('preserves the raw archive when old data cannot migrate safely', () => {
    const game = createGame(1000);
    game.characters[0]!.outfit.top = 'unknown';
    const raw = JSON.stringify({ revision: 2, commitId: 'bad', game });
    localStorage.setItem(GAME.storageKey, raw);
    const loaded = loadGame(localStorage, 1000, false);
    expect(loaded.status).toBe('invalid');
    expect(loaded.raw).toBe(raw);
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
  });
});
