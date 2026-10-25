import { describe, expect, it } from 'vitest';
import { ACTIVITY, GAME } from '../data/constants';
import { CAMPUS_EVENTS, findEvent } from '../data/events';
import { INTERACTIONS, GIFTS } from '../data/interactions';
import { queuedEvent } from '../test/eventGame';
import { oldM3Game } from '../test/oldSave';
import { createBeds, createGame } from './initial';
import { interact, type InteractionCommand } from './interactions';
import {
  chooseEvent,
  eligibleEventResidents,
  eventChoiceError,
  scheduleRoomEvents,
} from './events';
import { applyEffects } from './effects';
import {
  changeStats,
  isComplete,
  renderLog,
  settleDay,
  statKeys,
} from './rules';
import { advanceTime } from './time';
import { gameSchema, type GameState } from './model';
import { decodeSave } from './migrations';
import { renderActivityLog } from './activityText';
import { createGameStore } from '../state/game';

function command(
  game: GameState,
  actionId: InteractionCommand['actionId'] = 'tidy',
  operationId: string = crypto.randomUUID(),
): InteractionCommand {
  return {
    operationId,
    expectedDay: game.day,
    characterId: game.characters[0]!.id,
    kind: 'normal',
    actionId,
  };
}
function gift(
  game: GameState,
  operationId: string = crypto.randomUUID(),
): InteractionCommand {
  return {
    operationId,
    expectedDay: game.day,
    characterId: game.characters[0]!.id,
    kind: 'gift',
    giftId: 'ribbon',
  };
}
describe('M4 bounded daily interaction rules', () => {
  it('allows exactly three ordinary actions and one gift, with real costs and independent counters', () => {
    let game = createGame(1000);
    for (let count = 0; count < 3; count++) {
      const result = interact(game, command(game));
      expect(result.error).toBeUndefined();
      game = result.game;
    }
    expect(game.characters[0]!.daily.interactions).toBe(3);
    expect(game.characters[0]!.stats.energy).toBe(64);
    expect(interact(game, command(game)).game).toBe(game);
    const sent = interact(game, gift(game));
    expect(sent.error).toBeUndefined();
    game = sent.game;
    expect(game.wallet.tokens).toBe(12);
    expect(game.characters[0]!.daily.gifts).toBe(1);
    expect(interact(game, gift(game)).game).toBe(game);
    expect(game.characters[0]!.stats.progress).toBe(3);
    expect(game.characters[0]!.daily.operationIds).toHaveLength(4);
  });
  it('deduplicates receipts and rejects stale, malformed, missing-character and readonly commands atomically', () => {
    const initial = createGame(1000);
    const request = command(initial, 'talk', 'once');
    const done = interact(initial, request).game;
    expect(interact(done, request).game).toBe(done);
    const next = settleDay(done, 1, 'manual');
    expect(interact(next, request).game).toBe(next);
    for (const bad of [
      { ...request, characterId: 'missing' },
      { ...request, giftId: 'tea' },
      { ...request, extra: true },
    ])
      expect(interact(initial, bad).game).toBe(initial);
    initial.player.identity = 'observer';
    expect(interact(initial, request).game).toBe(initial);
    initial.player.identity = 'leader';
    initial.setup = 'room';
    expect(interact(initial, request).game).toBe(initial);
  });
  it('checks energy, stamina and currency before changing counts, and offers a recovery path at zero energy', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.energy = 0;
    expect(interact(game, command(game, 'talk')).game).toBe(game);
    expect(interact(game, gift(game)).game).toBe(game);
    const rested = interact(game, command(game, 'stretch'));
    expect(rested.error).toBeUndefined();
    expect(rested.game.characters[0]!.stats.energy).toBeGreaterThan(0);
    game.characters[0]!.stats.energy = 10;
    game.wallet.tokens = 0;
    expect(interact(game, gift(game)).game).toBe(game);
    game.characters[0]!.stats.stamina = 0;
    expect(interact(game, command(game)).game).toBe(game);
  });
  it('uses profession gains, integer bounds and a shared progress ledger for every source without refunds', () => {
    const game = createGame(1000);
    game.characters[0]!.major = 'art';
    game.characters[0]!.stats.mood = 99;
    const result = interact(game, command(game, 'talk')).game;
    expect(result.characters[0]!.stats.mood).toBe(100);
    let affected = applyEffects(
      game,
      ['resident-1'],
      { progress: 3 },
      'interaction',
    ).game;
    affected = applyEffects(
      affected,
      ['resident-1'],
      { progress: -2 },
      'event',
    ).game;
    affected = applyEffects(
      affected,
      ['resident-1'],
      { progress: 9 },
      'event',
    ).game;
    expect(affected.characters[0]!.stats.progress).toBe(1);
    const settled = settleDay(affected, 1, 'manual');
    expect(settled.characters[0]!.stats.progress).toBe(1);
    expect(settled.characters[0]!.daily.progressGained).toBe(0);
    for (const key of statKeys)
      expect(Number.isInteger(result.characters[0]!.stats[key])).toBe(true);
    expect(
      isComplete({
        ...result.characters[0]!,
        stats: { ...result.characters[0]!.stats, progress: 100 },
        settledDays: 29,
      }),
    ).toBe(false);
  });
  it('records actual source totals and grants the daily allowance exactly once', () => {
    const initial = createGame(1000);
    const interacted = interact(initial, command(initial)).game;
    const settled = settleDay(interacted, 1, 'manual');
    const log = settled.logs.find((entry) => entry.type === 'day')!;
    expect(settled.wallet.tokens).toBe(
      ACTIVITY.startingTokens + ACTIVITY.dailyTokens,
    );
    expect(settleDay(settled, 1, 'manual')).toBe(settled);
    expect(
      log.type === 'day' && log.results[0]!.activity.interaction.progress,
    ).toBe(1);
    expect(log.type === 'day' && log.results[0]!.delta.progress).toBe(2);
    expect(settled.characters[0]!.daily.interactions).toBe(0);
    expect(settled.characters[0]!.daily.changes.interaction.progress).toBe(0);
  });
  it('keeps every initial action and gift reachable without a hidden source of rewards', () => {
    const game = createGame(1000);
    game.settings.roleplay = true;
    game.characters[0]!.roleplay = true;
    for (const action of INTERACTIONS)
      expect(interact(game, command(game, action.id)).error).toBeUndefined();
    for (const item of GIFTS)
      expect(
        interact(game, { ...gift(game), giftId: item.id }).error,
      ).toBeUndefined();
  });
});

describe('M4 seeded events and exactly-once choices', () => {
  it('provides 26 distinct reachable templates including eight branches with a free exit', () => {
    expect(CAMPUS_EVENTS).toHaveLength(26);
    expect(new Set(CAMPUS_EVENTS.map((event) => event.id)).size).toBe(26);
    expect(CAMPUS_EVENTS.filter((event) => event.branch)).toHaveLength(8);
    for (const event of CAMPUS_EVENTS) {
      const game = createGame(1000);
      game.player.identity = event.condition.identities?.[0] ?? 'leader';
      const actor = game.characters[0]!;
      actor.major = event.condition.majors?.[0] ?? 'daily';
      actor.tags = event.condition.tags?.slice(0, 1) ?? [];
      actor.stats.progress = 10;
      if (event.condition.bathrooms)
        game.rooms[0]!.facilities.bathroom = event.condition.bathrooms[0]!;
      game.rooms[0]!.facilities.dryWet = event.condition.dryWet ?? false;
      expect(
        eligibleEventResidents(game, game.rooms[0]!, event, 4).length,
      ).toBeGreaterThan(0);
      expect(eligibleEventResidents(game, game.rooms[0]!, event, 1)).toEqual(
        [],
      );
      if (event.branch)
        expect(event.outcomes.some((outcome) => !outcome.cost)).toBe(true);
    }
  });
  it('respects facility, profession, identity, affection, tag and day conditions', () => {
    const game = createGame(1000);
    const room = game.rooms[0]!;
    expect(
      eligibleEventResidents(game, room, findEvent('bathroom-mirror')!, 4),
    ).toEqual([]);
    expect(
      eligibleEventResidents(game, room, findEvent('ribbon-studio')!, 4),
    ).toEqual([]);
    expect(
      eligibleEventResidents(game, room, findEvent('warm-reading')!, 4),
    ).toEqual([]);
    game.characters[0]!.major = 'literature';
    game.characters[0]!.stats.affection = 34;
    expect(
      eligibleEventResidents(game, room, findEvent('warm-reading')!, 4),
    ).toEqual([]);
    game.player.identity = 'parent';
    expect(
      eligibleEventResidents(game, room, findEvent('common-room-plan')!, 4),
    ).toEqual([]);
    game.characters[0]!.stats.progress = 10;
    expect(
      eligibleEventResidents(game, room, findEvent('rainy-window')!, 5),
    ).toEqual([]);
  });
  it('reproduces rolls and targets, checks a day once, and never repeats a template in a room', () => {
    let game = createGame(1000);
    game.characters[0]!.tags = ['可爱'];
    const twin = structuredClone(game);
    const run = (initial: GameState) => {
      let next = initial;
      for (let day = 1; day <= 40; day++) next = settleDay(next, day, 'manual');
      return next;
    };
    const a = run(game);
    const b = run(twin);
    expect(a.pendingEvents).toEqual(b.pendingEvents);
    expect(a.randomSeed).toBe(b.randomSeed);
    expect(a.eventProgress).toEqual(b.eventProgress);
    const seen = a.eventProgress[0]!.seenEventIds;
    expect(new Set(seen).size).toBe(seen.length);
    for (let day = 1; day <= 40; day++) {
      const triggers = [
        ...a.logs.filter(
          (log) => log.type === 'event' && log.triggerDay === day,
        ),
        ...a.pendingEvents.filter((event) => event.day === day),
      ];
      expect(triggers.length).toBeLessThanOrEqual(day === 1 ? 0 : 1);
    }
    game = scheduleRoomEvents(game, 1);
    expect(scheduleRoomEvents(game, 1)).toEqual(game);
    const result = run(createGame(1000));
    expect(gameSchema.safeParse(result).success).toBe(true);
  });
  it.each(
    CAMPUS_EVENTS.filter((event) => event.branch).map((event) => event.id),
  )('can reach and resolve both real branches of %s', (eventId) => {
    const game = queuedEvent(eventId);
    const pending = game.pendingEvents.find(
      (item) => item.eventId === eventId,
    )!;
    expect(gameSchema.safeParse(game).success).toBe(true);
    for (const outcome of findEvent(eventId)!.outcomes) {
      const resolved = chooseEvent(game, {
        instanceId: pending.id,
        choiceId: outcome.id,
      });
      expect(resolved.error).toBeUndefined();
      expect(
        resolved.game.pendingEvents.some((event) => event.id === pending.id),
      ).toBe(false);
      expect(resolved.game.resolvedEventIds).toContain(
        `event:${eventId}:${outcome.id}`,
      );
      expect(
        chooseEvent(resolved.game, {
          instanceId: pending.id,
          choiceId: outcome.id,
        }).game,
      ).toBe(resolved.game);
      expect(gameSchema.safeParse(resolved.game).success).toBe(true);
    }
  });
  it('does not reward closing, refreshing, invalid choices, stale IDs or unaffordable branches', () => {
    const game = queuedEvent();
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'ribbon-studio',
    )!;
    const restored = decodeSave(
      JSON.parse(JSON.stringify({ revision: 1, commitId: 'reload', game })),
    ).game;
    expect(restored).toEqual(game);
    expect(
      chooseEvent(game, { instanceId: pending.id, choiceId: 'missing' }).game,
    ).toBe(game);
    expect(
      chooseEvent(game, { instanceId: 'missing', choiceId: 'photo' }).game,
    ).toBe(game);
    game.wallet.tokens = 0;
    game.characters.forEach((character) => {
      character.stats.energy = 0;
      character.stats.stamina = 0;
    });
    expect(
      chooseEvent(game, { instanceId: pending.id, choiceId: 'photo' }).game,
    ).toBe(game);
    expect(
      eventChoiceError(game, pending, findEvent('ribbon-studio')!.outcomes[1]!),
    ).toBeUndefined();
    expect(
      chooseEvent(game, { instanceId: pending.id, choiceId: 'colors' }).error,
    ).toBeUndefined();
  });
  it('applies deferred rewards to the current day budget and unlocks clothing once', () => {
    let game = queuedEvent();
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'ribbon-studio',
    )!;
    game = settleDay(game, game.day, 'manual');
    const actorId = pending.characterIds[0]!;
    game.characters = game.characters.map((character) =>
      character.id === actorId
        ? changeStats(character, { progress: 3 }, game.day)
        : character,
    );
    const before = game.characters.find((actor) => actor.id === actorId)!.stats
      .progress;
    const result = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: 'photo',
    }).game;
    expect(
      result.characters.find((actor) => actor.id === actorId)!.stats.progress,
    ).toBe(before);
    expect(result.wardrobe.unlockedIds).toContain('lace-shirt');
    const log = result.logs.find(
      (entry) => entry.type === 'event' && entry.instanceId === pending.id,
    )!;
    expect(log.day).toBe(game.day);
    expect(log.type === 'event' && log.triggerDay).toBe(pending.day);
    expect(new Set(result.wardrobe.unlockedIds).size).toBe(
      result.wardrobe.unlockedIds.length,
    );
  });
  it('caps offline catchup and queue growth without selecting any branch or losing pending choices', () => {
    const game = queuedEvent();
    const restored = advanceTime(
      game,
      1000 + 50 * GAME.normalInterval,
      false,
      true,
    );
    expect(restored.advanced).toBe(7);
    expect(restored.game.pendingEvents.length).toBeLessThanOrEqual(3);
    for (const pending of game.pendingEvents)
      expect(restored.game.pendingEvents).toContainEqual(pending);
    expect(
      restored.game.logs
        .filter((log) => log.type === 'event')
        .every((log) => !findEvent(log.eventId)!.branch),
    ).toBe(true);
    expect(gameSchema.safeParse(restored.game).success).toBe(true);
    let full = restored.game;
    for (let index = 0; index < 30; index++)
      full = settleDay(full, full.day, 'auto');
    expect(full.pendingEvents).toHaveLength(3);
    const seenBefore = full.eventProgress[0]!.seenEventIds;
    const later = settleDay(full, full.day, 'auto');
    expect(later.eventProgress[0]!.seenEventIds).toEqual(seenBefore);
  });
  it('checks and settles all rooms independently once per day', () => {
    let game = createGame(1000);
    const room = {
      ...game.rooms[0]!,
      id: 'room-102',
      beds: createBeds('room-102', 4, 'loft'),
    };
    game.rooms.push(room);
    game.characters[3]!.roomId = room.id;
    game.characters[3]!.bedId = room.beds[0]!.id;
    for (let day = 1; day <= 6; day++) game = settleDay(game, day, 'manual');
    expect(game.eventProgress).toHaveLength(2);
    expect(
      game.eventProgress.every((ledger) => ledger.checkedThrough === 6),
    ).toBe(true);
    expect(
      game.characters.every((character) => character.settledDays === 6),
    ).toBe(true);
    expect(gameSchema.safeParse(game).success).toBe(true);
  });
});

describe('M4 current-consent history and persistence', () => {
  it('rerenders ordinary/roleplay interactions and past events without duplicating rapport or saving special prose', () => {
    let game = queuedEvent();
    game.settings.roleplay = true;
    game.characters[0]!.roleplay = true;
    game = interact(game, command(game, 'roleplay')).game;
    const interaction = game.logs.at(-1)!;
    expect(renderLog(game, interaction)).toContain('主人/男仆');
    expect(renderLog(game, interaction)).toContain('听话值');
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'ribbon-studio',
    )!;
    game = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: 'photo',
    }).game;
    const event = game.logs.find(
      (log) => log.type === 'event' && log.instanceId === pending.id,
    )!;
    expect(renderLog(game, event)).toContain('主人/男仆');
    const rapport = game.characters[0]!.stats.rapport;
    for (const mode of ['global', 'character', 'parent'] as const) {
      const off = structuredClone(game);
      if (mode === 'global') off.settings.roleplay = false;
      if (mode === 'character') off.characters[0]!.roleplay = false;
      if (mode === 'parent') off.player.identity = 'parent';
      expect(renderLog(off, interaction)).not.toMatch(/听话值|主人|男仆/u);
      expect(renderLog(off, event)).not.toMatch(/听话值|主人|男仆/u);
      expect(off.characters[0]!.stats.rapport).toBe(rapport);
      expect(interact(off, command(off, 'roleplay')).game).toBe(off);
    }
    expect(JSON.stringify(game.logs)).not.toMatch(/主人|男仆|听话值/u);
    expect(event.type === 'event' && renderActivityLog(game, event)).toContain(
      '奶油花边衬衫',
    );
  });
  it('migrates actual 1.2 data while preserving colors, progress, counters and old logs without retroactive rewards', () => {
    const original = oldM3Game(settleDay(createGame(1000), 1, 'manual'));
    original.characters[0]!.daily.interactions = 2;
    original.characters[0]!.daily.gifts = 1;
    const raw = JSON.stringify(original);
    const migrated = decodeSave({
      revision: 3,
      commitId: 'm3-original',
      game: original,
    }).game;
    expect(migrated.version).toBe('1.6');
    expect(JSON.stringify(original)).toBe(raw);
    expect(migrated.wallet.tokens).toBe(20);
    expect(migrated.characters[0]!.daily.operationIds).toHaveLength(3);
    expect(migrated.characters[0]!.appearance).toEqual({
      ...original.characters[0]!.appearance,
      face: 'gentle',
    });
    expect(migrated.characters[0]!.stats).toEqual(
      original.characters[0]!.stats,
    );
    expect(migrated.eventProgress[0]!.checkedThrough).toBe(1);
    expect(
      migrated.logs[0]!.type === 'day' && migrated.logs[0]!.allowance,
    ).toBe(0);
  });
  it('rejects corrupt receipts, queue references, future triggers, currency and unknown event templates', () => {
    const original = queuedEvent();
    for (const mutate of [
      (game: GameState) => {
        game.wallet.tokens = -1;
      },
      (game: GameState) => {
        game.characters[0]!.daily.interactions = 4;
      },
      (game: GameState) => {
        game.characters[0]!.daily.operationIds.push('unearned');
      },
      (game: GameState) => {
        game.pendingEvents[0]!.eventId = 'fake-event';
      },
      (game: GameState) => {
        game.pendingEvents[0]!.day = game.day + 1;
      },
      (game: GameState) => {
        game.pendingEvents[0]!.characterIds = ['missing'];
      },
    ]) {
      const game = structuredClone(original);
      mutate(game);
      expect(gameSchema.safeParse(game).success).toBe(false);
    }
  });
  it('persists interactions and choices across refresh and blocks a stale writer from rewarding twice', async () => {
    localStorage.clear();
    const initial = queuedEvent();
    localStorage.setItem(
      GAME.storageKey,
      JSON.stringify({ revision: 1, commitId: 'fixture', game: initial }),
    );
    const store = () =>
      createGameStore(
        localStorage,
        () => 1000,
        () => false,
        () => true,
      );
    const first = store();
    const stale = store();
    expect(
      (await first.getState().interact(command(initial))).error,
    ).toBeUndefined();
    const raw = localStorage.getItem(GAME.storageKey);
    expect(
      (await stale.getState().interact(command(initial))).error,
    ).toBeTruthy();
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    const restored = store();
    expect(restored.getState().game.characters[0]!.daily.interactions).toBe(1);
    const pending = initial.pendingEvents.find(
      (event) => event.eventId === 'ribbon-studio',
    )!;
    expect(
      (
        await restored
          .getState()
          .chooseEvent({ instanceId: pending.id, choiceId: 'photo' })
      ).error,
    ).toBeUndefined();
    const loaded = store();
    expect(loaded.getState().game.resolvedEventIds).toContain(pending.id);
    expect(
      loaded
        .getState()
        .game.pendingEvents.some((item) => item.id === pending.id),
    ).toBe(false);
  });
});
