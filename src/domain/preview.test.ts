import { describe, expect, it, vi } from 'vitest';
import { INTERACTIONS, GIFTS } from '../data/interactions';
import { IDENTITY_ACTIONS } from '../data/identityActions';
import { findEvent } from '../data/events';
import { createGame } from './initial';
import { previewEffects } from './preview';
import { interact, settleIdleInteractions } from './interactions';
import { applyEffects } from './effects';
import { changeWardrobe } from './wardrobe';
import { syncProgress } from './progress';
import { performIdentityAction } from './identityActions';
import { chooseEvent } from './events';
import { queuedEvent } from '../test/eventGame';
import { gameSchema } from './model';
import { exportArchive, previewImport } from './saves';
import { encodeCompact } from './compactSave';

const actor = 'resident-1';
function command(actionId: string, operationId = 'recovery-test') {
  return {
    operationId,
    expectedDay: 1,
    characterId: actor,
    kind: 'normal',
    actionId,
  };
}
describe('pure exact consequence previews', () => {
  it('predicts last-stamina leave without changing state, RNG, journal IDs or persistence', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.stamina = 4;
    const original = structuredClone(game);
    const ids = vi.spyOn(crypto, 'randomUUID');
    const tidy = INTERACTIONS.find((action) => action.id === 'tidy')!;
    for (let count = 0; count < 10; count++) {
      const preview = previewEffects(game, {
        characterIds: [actor],
        changes: tidy.delta,
        cost: tidy.cost,
      });
      expect(preview.residents[0]!.incidents).toMatchObject([
        { reason: 'stamina', leaveUntilDay: 8 },
      ]);
      expect(preview.residents[0]!.after.stamina).toBe(0);
    }
    expect(ids).not.toHaveBeenCalled();
    expect(game).toEqual(original);
    ids.mockRestore();
    const actual = interact(game, command('tidy'));
    expect(actual.error).toBeUndefined();
    expect(actual.game.characters[0]!.condition.leaveUntilDay).toBe(8);
  });
  it('matches energy → mood → halving and clothing recall, including the action gain before halving', () => {
    let game = createGame(1000);
    Object.assign(game.characters[0]!.stats, {
      energy: 3,
      mood: 1,
      progress: 100,
      affection: 41,
    });
    game = changeWardrobe(syncProgress(game), {
      type: 'maid-set',
      characterId: actor,
    }).game;
    const talk = INTERACTIONS.find((action) => action.id === 'talk')!;
    const preview = previewEffects(game, {
      characterIds: [actor],
      changes: talk.delta,
      cost: talk.cost,
    });
    const row = preview.residents[0]!;
    expect(row.incidents.map((incident) => incident.reason)).toEqual([
      'energy',
      'mood',
    ]);
    expect(row.after).toMatchObject({
      affection: 21,
      progress: 50,
      mood: 0,
      energy: 0,
    });
    expect(row.outfitStored).toBe(true);
    const actual = interact(game, command('talk'));
    expect(actual.error).toBeUndefined();
    expect(actual.game.characters[0]!.stats).toEqual(row.after);
    expect(actual.game.characters[0]!.outfit.top).toBe('basic-top');
  });
  it('uses professional rounding, stat clamps, spent progress quota and clamped rewards', () => {
    const game = createGame(1000);
    game.characters[0]!.major = 'art';
    Object.assign(game.characters[0]!.stats, { mood: 99, progress: 44 });
    game.characters[0]!.daily.progressGained = 3;
    game.wallet.tokens = 9998;
    const request = {
      characterIds: [actor],
      changes: { mood: 8, progress: 10 },
      cost: { energy: 2 },
      tokenChange: 8,
    };
    const preview = previewEffects(game, request);
    expect(preview.residents[0]!.delta).toMatchObject({
      mood: 1,
      progress: 0,
      energy: -2,
    });
    expect(preview.tokens).toBe(9999);
    expect(
      applyEffects(game, [actor], request.changes, 'event', request.cost).game
        .characters[0]!.stats,
    ).toEqual(preview.residents[0]!.after);
  });
  it('shows each participant and the one shared token cost, excludes resting residents and clamps habitability', () => {
    const game = createGame(1000);
    game.characters[3]!.condition.leaveUntilDay = 8;
    game.rooms[0]!.habitability = 99;
    game.characters[0]!.stats.stamina = 6;
    const action = IDENTITY_ACTIONS.find((row) => row.id === 'cleanup')!;
    const ids = game.characters.slice(0, 3).map((row) => row.id);
    const preview = previewEffects(game, {
      characterIds: ids,
      changes: action.delta,
      cost: action.cost,
      roomChange: { roomId: game.rooms[0]!.id, delta: action.habitability },
    });
    expect(preview.residents).toHaveLength(3);
    expect(preview.room).toMatchObject({ before: 99, after: 100 });
    const actual = performIdentityAction(game, {
      operationId: 'group-preview',
      expectedDay: 1,
      identity: 'leader',
      roomId: game.rooms[0]!.id,
      actionId: 'cleanup',
    });
    expect(actual.error).toBeUndefined();
    for (const row of preview.residents)
      expect(
        actual.game.characters.find(
          (character) => character.id === row.characterId,
        )!.stats,
      ).toEqual(row.after);
    expect(actual.game.rooms[0]!.habitability).toBe(preview.room!.after);
    expect(actual.game.characters[3]).toEqual(game.characters[3]);
  });
  it('matches a delayed event choice and leaves its queue untouched while previewing', () => {
    const game = queuedEvent('power-outage');
    const pending = game.pendingEvents.find(
      (row) => row.eventId === 'power-outage',
    )!;
    for (const character of game.characters)
      Object.assign(character.stats, {
        energy: 6,
        mood: 1,
        progress: 99,
        affection: 43,
      });
    const outcome = findEvent('power-outage')!.outcomes[0]!;
    const before = structuredClone(game);
    const preview = previewEffects(game, {
      characterIds: pending.characterIds,
      changes: outcome.delta,
      cost: outcome.cost,
      tokenChange: outcome.tokens - (outcome.cost?.tokens ?? 0),
    });
    expect(game).toEqual(before);
    const actual = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: outcome.id,
    });
    expect(actual.error).toBeUndefined();
    for (const row of preview.residents)
      expect(
        actual.game.characters.find(
          (character) => character.id === row.characterId,
        )!.stats,
      ).toEqual(row.after);
    expect(actual.game.wallet.tokens).toBe(preview.tokens);
  });
  it('includes a gift cost that reaches zero and does not warn again for an already latched zero', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.energy = 1;
    const gift = GIFTS.find((row) => row.id === 'bookmark')!;
    const preview = previewEffects(game, {
      characterIds: [actor],
      changes: gift.delta,
      cost: gift.cost,
    });
    expect(preview.residents[0]!.incidents[0]!.reason).toBe('energy');
    const result = interact(game, {
      ...command('talk'),
      actionId: undefined,
      kind: 'gift',
      giftId: 'bookmark',
    });
    expect(result.error).toBeUndefined();
    expect(result.game.characters[0]!.stats).toEqual(
      preview.residents[0]!.after,
    );
    expect(result.game.wallet.tokens).toBe(preview.tokens);
    const repeated = previewEffects(result.game, {
      characterIds: [actor],
      changes: {},
    });
    expect(repeated.residents[0]!.incidents).toEqual([]);
  });
});
describe('active recovery uses the real interaction pipeline', () => {
  it.each(INTERACTIONS.filter((action) => action.recovery))(
    'applies $name costs, actual recovery and durable counts without growth rewards',
    (action) => {
      const game = createGame(1000);
      Object.assign(game.characters[0]!.stats, {
        stamina: 40,
        energy: 20,
        mood: 20,
      });
      const preview = previewEffects(game, {
        characterIds: [actor],
        changes: action.delta,
        cost: action.cost,
      });
      const actual = interact(game, command(action.id));
      expect(actual.error).toBeUndefined();
      expect(actual.game.characters[0]!.stats).toEqual(
        preview.residents[0]!.after,
      );
      expect(actual.game.wallet.tokens).toBe(preview.tokens);
      expect(actual.game.characters[0]!.stats.progress).toBe(0);
      expect(actual.game.characters[0]!.daily.interactions).toBe(1);
      expect(gameSchema.safeParse(actual.game).success).toBe(true);
      expect(previewImport(exportArchive(actual.game)).game).toEqual(
        actual.game,
      );
      expect(
        previewImport(
          encodeCompact({
            revision: 1,
            commitId: 'recovery',
            game: actual.game,
          }),
        ).game,
      ).toEqual(actual.game);
    },
  );
  it('shares three ordinary actions, preserves the independent gift allowance and never resets on refresh', () => {
    let game = createGame(1000);
    for (const [index, action] of ['nap', 'meal', 'walk'].entries()) {
      const next = interact(game, command(action, 'quota-' + index));
      expect(next.error).toBeUndefined();
      game = next.game;
    }
    const restored = previewImport(exportArchive(game)).game;
    expect(interact(restored, command('comfort', 'fourth')).game).toBe(
      restored,
    );
    expect(interact(restored, command('talk', 'regular-fourth')).game).toBe(
      restored,
    );
    expect(
      interact(restored, {
        ...command('talk', 'gift-after-recovery'),
        actionId: undefined,
        kind: 'gift',
        giftId: 'bookmark',
      }).error,
    ).toBeUndefined();
  });
  it('offers a zero-currency nap before a crisis, and blocks insufficient costs, leave, stale and duplicate requests', () => {
    const game = createGame(1000);
    game.wallet.tokens = 0;
    game.characters[0]!.stats.energy = 0;
    game.characters[0]!.condition.energyZero = true;
    const nap = interact(game, command('nap'));
    expect(nap.error).toBeUndefined();
    expect(nap.game.characters[0]!.stats.energy).toBe(10);
    expect(interact(nap.game, command('nap')).game).toBe(nap.game);
    expect(interact(game, command('meal')).game).toBe(game);
    expect(interact(game, { ...command('nap'), expectedDay: 2 }).game).toBe(
      game,
    );
    game.characters[0]!.condition.leaveUntilDay = 8;
    expect(interact(game, command('nap')).game).toBe(game);
    game.characters[0]!.condition.leaveUntilDay = 0;
    game.player.identity = 'observer';
    expect(interact(game, command('nap')).game).toBe(game);
  });
  it('keeps recovery opt-in and does not make autonomous choices spend currency', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const game = createGame(1000);
      game.randomSeed = seed;
      const next = settleIdleInteractions(game);
      const logs = next.logs.filter((log) => log.type === 'interaction');
      expect(logs).toHaveLength(4);
      expect(
        logs.every((log) =>
          ['talk', 'tidy', 'stretch'].includes(log.actionId!),
        ),
      ).toBe(true);
      expect(next.wallet.tokens).toBe(game.wallet.tokens);
    }
  });
});
