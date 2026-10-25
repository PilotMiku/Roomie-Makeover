import { describe, expect, it } from 'vitest';
import { IDENTITY_ACTIONS } from '../data/identityActions';
import { FACE_IDS } from '../data/faces';
import { CLOTHES, OPEN_SLOTS } from '../data/clothes';
import { createBeds, createGame } from './initial';
import { queuedEvent } from '../test/eventGame';
import { chooseEvent } from './events';
import { gameSchema, type GameState } from './model';
import { performIdentityAction } from './identityActions';
import { changeWardrobe } from './wardrobe';
import { syncWardrobeUnlocks } from './unlocks';
import { customizeGame } from './customize';
import { naturalDelta, settleDay, renderLog } from './rules';
import {
  avatarPixels,
  avatarSignature,
  portraitLayers,
} from '../render/pixels';
import { encodeCompact, decodeCompact } from './compactSave';
import { decodeSave } from './migrations';
import { oldM7Game, oldCompactArchive } from '../test/oldSave';

function action(
  game: GameState,
  actionId = 'cleanup',
  operationId = 'campus-action',
) {
  return performIdentityAction(game, {
    actionId,
    operationId,
    expectedDay: game.day,
    identity: game.player.identity,
    roomId: game.rooms[0]!.id,
  });
}
function progress(value: number) {
  const game = createGame(1000);
  game.characters[0]!.stats.progress = value;
  return syncWardrobeUnlocks(game);
}
describe('individual progress gates and visible styling', () => {
  it.each([49, 50, 99, 100])(
    'enforces exact dress and maid thresholds at %i',
    (value) => {
      const game = progress(value);
      expect(game.wardrobe.unlockedIds.includes('petal-skirt')).toBe(
        value >= 50,
      );
      expect(game.wardrobe.unlockedIds.includes('maid-skirt')).toBe(
        value === 100,
      );
      const skirt = changeWardrobe(game, {
        type: 'equip',
        characterId: 'resident-1',
        slot: 'skirt',
        itemId: 'petal-skirt',
      });
      expect(Boolean(skirt.error)).toBe(value < 50);
      const maid = changeWardrobe(game, {
        type: 'maid-set',
        characterId: 'resident-1',
      });
      expect(Boolean(maid.error)).toBe(value < 100);
      if (value === 100) {
        expect(maid.game.characters[0]!.outfit).toMatchObject({
          top: 'maid-blouse',
          skirt: 'maid-skirt',
          accessory: 'maid-headband',
          makeup: 'doll-makeup',
        });
        const before = portraitLayers(game.characters[0]!);
        const after = portraitLayers(maid.game.characters[0]!);
        for (const layer of ['top', 'skirt', 'accessory', 'makeup'] as const) {
          expect(after[layer].length).toBeGreaterThan(0);
          expect(after[layer]).not.toEqual(before[layer]);
        }
        expect(after.bottom).toEqual([]);
        expect(avatarPixels(maid.game.characters[0]!)).not.toEqual(
          avatarPixels(game.characters[0]!),
        );
      }
    },
  );
  it('prevents low-progress residents using globally collected items, presets, random or imports', () => {
    let game = progress(100);
    game = changeWardrobe(game, {
      type: 'maid-set',
      characterId: 'resident-1',
    }).game;
    game = changeWardrobe(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '蕾丝午后',
    }).game;
    expect(
      changeWardrobe(game, {
        type: 'apply-preset',
        characterId: 'resident-2',
        presetId: game.wardrobe.presets[0]!.id,
      }).game,
    ).toBe(game);
    for (let count = 0; count < 30; count++) {
      game = changeWardrobe(game, {
        type: 'random',
        characterId: 'resident-2',
      }).game;
      for (const slot of OPEN_SLOTS) {
        const item = CLOTHES.find(
          (item) => item.id === game.characters[1]!.outfit[slot],
        );
        expect(item?.minProgress ?? 0).toBe(0);
      }
    }
    game.characters[1]!.outfit.skirt = 'maid-skirt';
    expect(gameSchema.safeParse(game).success).toBe(false);
  });
  it('renders six different faces and invalidates map appearance signatures', () => {
    const original = createGame(1000).characters[0]!;
    const variants = FACE_IDS.map((face) => ({
      ...original,
      appearance: { ...original.appearance, face },
    }));
    expect(new Set(variants.map(avatarSignature)).size).toBe(6);
    expect(
      new Set(
        variants.map((character) => JSON.stringify(avatarPixels(character))),
      ).size,
    ).toBe(6);
  });
});
describe('identity participation and habitability', () => {
  it('settles each room independently without changing the other residents', () => {
    const game = createGame(1000);
    game.rooms.push({
      ...game.rooms[0]!,
      id: 'room-next',
      name: '隔壁',
      beds: createBeds('room-next', 4, 'loft'),
    });
    game.eventProgress.push({
      roomId: 'room-next',
      checkedThrough: 0,
      seenEventIds: [],
    });
    game.characters[3] = {
      ...game.characters[3]!,
      roomId: 'room-next',
      bedId: 'room-next-bed-1',
    };
    const first = action(game).game;
    expect(first.characters[3]).toEqual(game.characters[3]);
    expect(first.rooms[1]!.habitability).toBe(60);
    const second = performIdentityAction(first, {
      operationId: 'neighbor-action',
      expectedDay: 1,
      identity: 'leader',
      roomId: 'room-next',
      actionId: 'cleanup',
    });
    expect(second.error).toBeUndefined();
    expect(second.game.rooms.map((room) => room.habitability)).toEqual([
      72, 72,
    ]);
    expect(second.game.identityActions.roomIds).toHaveLength(2);
    expect(second.game.characters[0]).toEqual(first.characters[0]);
  });
  it('applies role-story habitability once while keeping the decision pending until chosen', () => {
    const game = queuedEvent('leader-cleaning-day');
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'leader-cleaning-day',
    )!;
    const before = game.rooms[0]!.habitability;
    const result = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: 'clean',
    });
    expect(result.error).toBeUndefined();
    expect(result.game.rooms[0]!.habitability).toBe(Math.min(100, before + 10));
    expect(
      result.game.pendingEvents.some((event) => event.id === pending.id),
    ).toBe(false);
    const receipt = result.game.logs.find(
      (log) => log.type === 'event' && log.instanceId === pending.id,
    )!;
    expect(renderLog(result.game, receipt)).toContain('宜居度 +10');
    expect(
      chooseEvent(result.game, { instanceId: pending.id, choiceId: 'clean' })
        .game,
    ).toBe(result.game);
  });
  for (const definition of IDENTITY_ACTIONS)
    for (const identity of definition.identities)
      it(identity + ' can participate through ' + definition.id, () => {
        const game = createGame(1000);
        game.player.identity = identity;
        if (identity === 'custom') game.player.customTitle = '校园朋友';
        const result = action(game, definition.id);
        expect(result.error).toBeUndefined();
        expect(gameSchema.safeParse(result.game).success).toBe(true);
        expect(result.game.rooms[0]!.habitability).toBe(
          60 + definition.habitability,
        );
        expect(
          result.game.characters.every(
            (character) => character.daily.identityParticipated,
          ),
        ).toBe(true);
        expect(result.game.characters[0]!.stats.energy).toBe(
          70 - (definition.cost.energy ?? 0),
        );
        expect(result.game.characters[0]!.stats.stamina).toBe(
          70 - (definition.cost.stamina ?? 0),
        );
        expect(result.game.characters[0]!.stats.rapport).toBeGreaterThan(30);
        expect(result.game.wallet.tokens).toBe(
          game.wallet.tokens - (definition.cost.tokens ?? 0),
        );
        const log = result.game.logs.at(-1)!;
        expect(log.type).toBe('identity');
        expect(renderLog(result.game, log)).toContain('宜居度');
        expect(action(result.game, definition.id).game).toBe(result.game);
        const restored = decodeSave(
          decodeCompact(
            JSON.parse(
              encodeCompact({
                revision: 1,
                commitId: 'role-roundtrip',
                game: result.game,
              }),
            ),
          ),
        ).game;
        expect(restored).toEqual(result.game);
        expect(action(restored, definition.id, 'new-id').game).toBe(restored);
      });
  it('keeps all costs atomic, rejects stale/unauthorized actions and stops identity-switch farming', () => {
    const game = createGame(1000);
    game.characters[2]!.stats.stamina = 0;
    expect(action(game).game).toBe(game);
    expect(action(game, 'family-call').game).toBe(game);
    game.characters[2]!.stats.stamina = 70;
    const done = action(game).game;
    done.player.identity = 'parent';
    expect(action(done, 'family-call', 'other').game).toBe(done);
    expect(
      performIdentityAction(done, {
        operationId: 'stale',
        expectedDay: 2,
        identity: 'parent',
        roomId: done.rooms[0]!.id,
        actionId: 'family-call',
      }).game,
    ).toBe(done);
    const tomorrow = settleDay(done, 1, 'manual');
    expect(tomorrow.identityActions.roomIds).toEqual([]);
    expect(
      tomorrow.logs.filter(
        (log) =>
          log.type === 'interaction' && log.id.startsWith('auto-interaction:'),
      ),
    ).toHaveLength(0);
    expect(action(tomorrow, 'family-call', 'tomorrow').error).toBeUndefined();
  });
  it('clamps habitability and applies its real natural recovery bonus', () => {
    const game = createGame(1000);
    const room = game.rooms[0]!;
    room.habitability = 99;
    const done = action(game).game;
    expect(done.rooms[0]!.habitability).toBe(100);
    expect(done.logs.at(-1)).toMatchObject({ habitabilityDelta: 1 });
    const resident = game.characters[0]!;
    const baseline = naturalDelta(resident, { ...room, habitability: 60 });
    const cozy = naturalDelta(resident, { ...room, habitability: 80 });
    expect(cozy.mood - baseline.mood).toBe(1);
    expect(cozy.stamina - baseline.stamina).toBe(1);
  });
});
describe('random profession and genuine old archives', () => {
  it('immediately unlocks new maid pieces for a genuine old resident already at 100', () => {
    const original = createGame(1000);
    original.characters[0]!.stats.progress = 100;
    const old = oldM7Game(original);
    expect(old.wardrobe.unlockedIds).not.toContain('maid-skirt');
    const migrated = decodeSave({
      revision: 1,
      commitId: 'old-completed',
      game: old,
    }).game;
    expect(migrated.wardrobe.unlockedIds).toContain('maid-skirt');
    expect(
      changeWardrobe(migrated, { type: 'maid-set', characterId: 'resident-1' })
        .error,
    ).toBeUndefined();
    expect(migrated.characters[0]!.stats).toEqual(
      original.characters[0]!.stats,
    );
  });
  it.each(['random', undefined, 'daily', 'custom'] as const)(
    'handles unselected or explicit profession %s reproducibly',
    (major) => {
      const game = createGame(1000);
      const {
        id,
        stats,
        daily,
        growth,
        settledDays,
        outfit,
        condition,
        tagProgressGranted,
        ...input
      } = game.characters[0]!;
      void id;
      void stats;
      void daily;
      void growth;
      void settledDays;
      void outfit;
      void condition;
      void tagProgressGranted;
      const command = {
        type: 'character' as const,
        characterId: 'resident-1',
        input: {
          ...input,
          adultConfirmed: true,
          major,
          customMajor: major === 'custom' ? '花艺' : '',
        },
      };
      const first = customizeGame(game, command, 2000);
      const second = customizeGame(game, command, 2000);
      expect(first.error).toBeUndefined();
      expect(first.game.characters[0]!.major).toBe(
        second.game.characters[0]!.major,
      );
      expect(first.game.randomSeed).toBe(second.game.randomSeed);
      if (major === 'daily' || major === 'custom') {
        expect(first.game.characters[0]!.major).toBe(major);
        expect(first.game.randomSeed).toBe(game.randomSeed);
      } else {
        expect([
          'computing',
          'art',
          'sport',
          'literature',
          'medicine',
          'music',
        ]).toContain(first.game.characters[0]!.major);
        expect(first.game.randomSeed).not.toBe(game.randomSeed);
      }
      expect(
        customizeGame(
          game,
          { ...command, input: { ...command.input, roomId: 'missing' } },
          2000,
        ).game,
      ).toBe(game);
    },
  );
  it.each(['plain', 'compact'])(
    'migrates actual 1.4 %s without rerolling, resetting progress or losing portraits',
    (format) => {
      const game = progress(49);
      const raw =
        format === 'plain'
          ? JSON.stringify({
              revision: 1,
              commitId: 'm7',
              game: oldM7Game(game),
            })
          : oldCompactArchive(game, '1.4');
      const migrated = decodeSave(decodeCompact(JSON.parse(raw))).game;
      expect(migrated.version).toBe('1.6');
      expect(migrated.characters[0]!.stats.progress).toBe(49);
      expect(migrated.characters.map((character) => character.major)).toEqual(
        game.characters.map((character) => character.major),
      );
      expect(
        migrated.characters.every(
          (character) => character.appearance.face === 'gentle',
        ),
      ).toBe(true);
      expect(migrated.rooms[0]!.habitability).toBe(60);
    },
  );
});
