import { findEvent } from '../data/events';
import { describe, expect, it } from 'vitest';
import { GAME, SAVES } from '../data/constants';
import { multiRoomGame, residentInput } from '../test/multiRoom';
import { queuedEvent } from '../test/eventGame';
import { createGame } from './initial';
import { customizeGame, type CustomizeCommand } from './customize';
import { gameSchema, type GameState } from './model';
import { settleDay, changeBedType, renderLog } from './rules';
import { advanceTime } from './time';
import { chooseEvent } from './events';
import { changeWardrobe } from './wardrobe';
import { exportArchive, previewImport } from './saves';
import { createGameStore } from '../state/game';

function addRoom(game: GameState, capacity: 4 | 6 | 8 = 6) {
  const result = customizeGame(
    game,
    {
      type: 'room-create',
      input: {
        name: '隔壁草莓寝室',
        capacity,
        bedType: 'bunk',
        facilities: { bathroom: 'private', dryWet: true },
      },
    },
    1000,
  );
  expect(result.error).toBeUndefined();
  return result.game;
}
function migration(
  game: GameState,
  actorId = game.characters[0]!.id,
  roomId = game.rooms[1]!.id,
): Extract<CustomizeCommand, { type: 'migrate' }> {
  const character = game.characters.find((actor) => actor.id === actorId)!;
  const room = game.rooms.find((candidate) => candidate.id === roomId)!;
  return {
    type: 'migrate',
    characterId: actorId,
    fromRoomId: character.roomId,
    fromBedId: character.bedId,
    roomId,
    bedId:
      room.beds.find(
        (bed) => !game.characters.some((actor) => actor.bedId === bed.id),
      )?.id ?? room.beds[0]!.id,
  };
}
describe('M6 room creation and capacity', () => {
  it('creates actual 4/6/8 beds and enforces six rooms and facility consistency', () => {
    let game = createGame(1000);
    for (const capacity of [4, 6, 8, 4, 6] as const) {
      game = addRoom(game, capacity);
      const room = game.rooms.at(-1)!;
      expect(room.beds).toHaveLength(capacity);
      expect(new Set(room.beds.map((bed) => bed.id)).size).toBe(capacity);
      expect(room.beds[0]!.level).toBe('upper');
      expect(room.beds[1]!.level).toBe('lower');
    }
    expect(addRoomRejected(game).game).toBe(game);
    const bad = customizeGame(
      createGame(1000),
      {
        type: 'room-create',
        input: {
          name: '矛盾设施',
          capacity: 4,
          bedType: 'loft',
          facilities: { bathroom: 'shared', dryWet: true },
        },
      },
      1000,
    );
    expect(bad.error).toBeTruthy();
    expect(bad.game.rooms).toHaveLength(1);
    expect(gameSchema.safeParse(game).success).toBe(true);
  });
  it('blocks new rooms before onboarding or for readonly identities', () => {
    const game = createGame(1000);
    game.setup = 'characters';
    expect(addRoomRejected(game).game).toBe(game);
    game.setup = 'done';
    for (const identity of [
      'observer',
      'member',
      'parent',
      'counselor',
      'neighbor',
    ] as const) {
      game.player.identity = identity;
      expect(addRoomRejected(game).game).toBe(game);
    }
  });
  it('fills mixed rooms to exactly 24 people and rejects the 25th despite other empty beds', () => {
    let game = multiRoomGame();
    expect(game.characters).toHaveLength(24);
    expect(game.rooms.map((room) => room.capacity)).toEqual([4, 6, 8, 6]);
    game = addRoom(game);
    const room = game.rooms.at(-1)!;
    const result = customizeGame(
      game,
      {
        type: 'character',
        input: residentInput(game, room.id, room.beds[0]!.id),
      },
      1000,
    );
    expect(result.error).toContain('24');
    expect(result.game).toBe(game);
    expect(gameSchema.safeParse(game).success).toBe(true);
  });
});
function addRoomRejected(game: GameState) {
  const result = customizeGame(
    game,
    {
      type: 'room-create',
      input: {
        name: '新房间',
        capacity: 4,
        bedType: 'loft',
        facilities: { bathroom: 'shared', dryWet: false },
      },
    },
    1000,
  );
  expect(result.error).toBeTruthy();
  return result;
}

describe('M6 atomic migration', () => {
  it('moves only the room and bed bindings, preserves wardrobe, growth, IDs, daily budgets and global rewards', () => {
    let game = addRoom(queuedEvent());
    game = changeWardrobe(game, {
      type: 'equip',
      characterId: 'resident-1',
      slot: 'top',
      itemId: 'duck-shirt',
    }).game;
    game = changeWardrobe(game, {
      type: 'save-preset',
      characterId: 'resident-1',
      name: '搬家穿搭',
    }).game;
    const before = structuredClone(game);
    const request = migration(game);
    const result = customizeGame(game, request, 1000);
    expect(result.error).toBeUndefined();
    const moved = result.game.characters[0]!;
    expect(moved).toEqual({
      ...before.characters[0],
      roomId: request.roomId,
      bedId: request.bedId,
    });
    for (const key of [
      'day',
      'lastSettledDay',
      'wallet',
      'randomSeed',
      'pendingEvents',
      'resolvedEventIds',
      'wardrobe',
      'legacy',
      'settings',
    ] as const)
      expect(result.game[key]).toEqual(before[key]);
    expect(result.game.characters.slice(1)).toEqual(before.characters.slice(1));
    expect(game).toEqual(before);
    expect(result.game.logs).toHaveLength(before.logs.length + 1);
    expect(renderLog(result.game, result.game.logs.at(-1)!)).toContain(
      '隔壁草莓寝室',
    );
    expect(customizeGame(result.game, request, 1000).game).toBe(result.game);
  });
  it('rejects full, occupied, nonexistent, mismatched and stale locations without detaching anyone', () => {
    const full = multiRoomGame();
    const fullRequest = migration(full);
    expect(customizeGame(full, fullRequest, 1000).game).toBe(full);
    const game = addRoom(createGame(1000));
    const request = migration(game);
    const firstMove = customizeGame(game, request, 1000).game;
    const occupied = {
      ...migration(firstMove, 'resident-2'),
      bedId: request.bedId,
    };
    expect(customizeGame(firstMove, occupied, 1000).game).toBe(firstMove);
    for (const bad of [
      { ...request, characterId: 'missing' },
      { ...request, roomId: 'missing' },
      { ...request, bedId: 'missing' },
      { ...request, bedId: game.characters[0]!.bedId },
      { ...request, fromBedId: 'stale' },
      { ...request, fromRoomId: 'stale' },
    ]) {
      expect(customizeGame(game, bad, 1000).game).toBe(game);
    }
    game.player.identity = 'parent';
    expect(customizeGame(game, request, 1000).game).toBe(game);
  });
  it('retains a pending story and rewards its original participants after one has moved', () => {
    const game = addRoom(queuedEvent('shared-bath-kit'));
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'shared-bath-kit',
    )!;
    const actorId = pending.characterIds[0]!;
    const request = migration(game, actorId);
    const moved = customizeGame(game, request, 1000).game;
    expect(moved.pendingEvents).toEqual(game.pendingEvents);
    const resolved = chooseEvent(moved, {
      instanceId: pending.id,
      choiceId: 'later',
    });
    expect(resolved.error).toBeUndefined();
    expect(
      resolved.game.characters.find((actor) => actor.id === actorId)!.roomId,
    ).toBe(request.roomId);
    expect(
      resolved.game.characters.find((actor) => actor.id === actorId)!.daily
        .changes.event.energy,
    ).toBeGreaterThan(0);
    expect(
      chooseEvent(resolved.game, { instanceId: pending.id, choiceId: 'later' })
        .game,
    ).toBe(resolved.game);
  });
  it('keeps imported custom bed IDs valid when switching bed type after migration', () => {
    const game = addRoom(createGame(1000));
    const room = game.rooms[1]!;
    room.beds.forEach((bed, index) => {
      bed.id = `custom-bed-${index}`;
    });
    const moved = customizeGame(game, migration(game), 1000).game;
    const changed = changeBedType(moved, room.id, 'loft');
    expect(gameSchema.safeParse(changed).success).toBe(true);
    expect(changed.characters[0]!.bedId).toBe('custom-bed-0');
  });
});

describe('M6 all-room settlement and persistence', () => {
  it('settles every resident once with the facilities of their current room and keeps one wallet allowance', () => {
    const game = multiRoomGame();
    const next = settleDay(game, 1, 'manual');
    expect(
      next.characters.every(
        (actor) => actor.settledDays === 1 && actor.daily.day === 2,
      ),
    ).toBe(true);
    const log = next.logs.find((entry) => entry.type === 'day')!;
    expect(log.type === 'day' && log.results).toHaveLength(24);
    if (log.type === 'day')
      for (const actor of game.characters)
        expect(
          log.results.find((result) => result.characterId === actor.id)!
            .bathroom,
        ).toBe(
          game.rooms.find((room) => room.id === actor.roomId)!.facilities
            .bathroom,
        );
    expect(next.wallet.tokens).toBe(game.wallet.tokens + 8);
    expect(settleDay(next, 1, 'manual')).toBe(next);
  });
  it('tracks events independently per room, bounds the global queue and does not auto-select branches', () => {
    const game = multiRoomGame();
    const next = advanceTime(
      game,
      1000 + 12 * GAME.normalInterval,
      false,
      true,
    );
    expect(next.advanced).toBe(7);
    expect(next.game.eventProgress).toHaveLength(4);
    expect(
      next.game.eventProgress.every((ledger) => ledger.checkedThrough === 7),
    ).toBe(true);
    expect(next.game.characters.every((actor) => actor.settledDays === 7)).toBe(
      true,
    );
    expect(next.game.pendingEvents.length).toBeLessThanOrEqual(3);
    for (const room of game.rooms)
      for (let day = 1; day <= 7; day++) {
        const triggered =
          next.game.logs.filter(
            (log) =>
              log.type === 'event' &&
              log.roomId === room.id &&
              log.triggerDay === day,
          ).length +
          next.game.pendingEvents.filter(
            (event) => event.roomId === room.id && event.day === day,
          ).length;
        expect(triggered).toBeLessThanOrEqual(1);
      }
    expect(
      next.game.logs
        .filter((log) => log.type === 'event')
        .every((log) => !findEvent(log.eventId)!.branch),
    ).toBe(true);
    expect(gameSchema.safeParse(next.game).success).toBe(true);
  });
  it('retains moved residents across stores, slot switching and export/import without duplicates', async () => {
    localStorage.clear();
    const game = addRoom(createGame(1000));
    localStorage.setItem(GAME.storageKey, exportArchive(game));
    const store = () =>
      createGameStore(
        localStorage,
        () => 1000,
        () => false,
        () => true,
      );
    const first = store();
    expect(
      (await first.getState().customize(migration(game))).error,
    ).toBeUndefined();
    const fresh = store();
    expect(fresh.getState().game.characters[0]!.roomId).toBe(game.rooms[1]!.id);
    const raw = exportArchive(fresh.getState().game);
    expect(previewImport(raw).game).toEqual(fresh.getState().game);
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
    await fresh.getState().manageSlot({ type: 'switch', slotId: 'slot-2' });
    expect(fresh.getState().game.characters).toHaveLength(4);
    expect(
      new Set(fresh.getState().game.characters.map((actor) => actor.id)).size,
    ).toBe(4);
  });
  it('keeps a 24-resident archive with 300 logs and growth records restorable under the 2 MiB limit', () => {
    let game = multiRoomGame();
    for (let day = 1; day <= 305; day++) game = settleDay(game, day, 'manual');
    const raw = exportArchive(game);
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThanOrEqual(
      SAVES.maxImportBytes,
    );
    expect(previewImport(raw).game).toEqual(game);
  });
});
