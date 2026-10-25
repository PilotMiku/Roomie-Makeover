import { describe, expect, it } from 'vitest';
import { ACTIVITY, GAME } from '../data/constants';
import { INTERACTIONS } from '../data/interactions';
import { multiRoomGame } from '../test/multiRoom';
import { applyEffects } from './effects';
import { createGame } from './initial';
import { interact, settleIdleInteractions } from './interactions';
import { gameSchema, type GameState } from './model';
import { renderLog, settleDay, statKeys } from './rules';
import { advanceTime, nextDay } from './time';
import { exportArchive, previewImport } from './saves';

function automaticLogs(game: GameState) {
  return game.logs
    .filter((log) => log.type === 'interaction')
    .filter((log) => log.id.startsWith(ACTIVITY.autoInteractionPrefix));
}

describe('idle roommates choose one daily interaction', () => {
  it('settles all 24 residents with real costs, source totals and exactly one choice per person', () => {
    const game = multiRoomGame();
    const original = structuredClone(game);
    const next = settleDay(game, game.day, 'manual');
    const logs = automaticLogs(next);
    expect(logs).toHaveLength(24);
    expect(new Set(logs.map((log) => log.characterId)).size).toBe(24);
    expect(next.wallet.tokens).toBe(game.wallet.tokens + ACTIVITY.dailyTokens);
    const day = next.logs.find((log) => log.type === 'day')!;
    for (const character of next.characters) {
      const receipt = logs.find((log) => log.characterId === character.id)!;
      const definition = INTERACTIONS.find(
        (action) => action.id === receipt.actionId,
      )!;
      expect(receipt.giftId).toBeNull();
      expect(definition.consentRequired).not.toBe(true);
      expect(receipt.cost).toEqual({
        energy: definition.cost.energy ?? 0,
        stamina: definition.cost.stamina ?? 0,
        tokens: 0,
      });
      const source = character.growth.filter(
        (entry) => entry.source === 'interaction',
      );
      expect(source).toHaveLength(1);
      expect(source[0]!.delta).toEqual(receipt.delta);
      expect(
        day.type === 'day' &&
          day.results.find((result) => result.characterId === character.id)!
            .activity.interaction,
      ).toEqual(receipt.delta);
      expect(character.daily.interactions).toBe(0);
      expect(character.daily.gifts).toBe(0);
      expect(character.daily.operationIds).toEqual([]);
      expect(character.settledDays).toBe(1);
    }
    expect(game).toEqual(original);
    expect(gameSchema.safeParse(next).success).toBe(true);
    expect(settleDay(next, 1, 'auto')).toBe(next);
  });

  it('honors each manual choice or gift while still choosing for untouched roommates', () => {
    let game = createGame(1000);
    game = interact(game, {
      operationId: 'manual-talk',
      expectedDay: 1,
      characterId: 'resident-1',
      kind: 'normal',
      actionId: 'talk',
    }).game;
    game = interact(game, {
      operationId: 'manual-gift',
      expectedDay: 1,
      characterId: 'resident-2',
      kind: 'gift',
      giftId: 'bookmark',
    }).game;
    const next = settleDay(game, 1, 'manual');
    expect(automaticLogs(next).map((log) => log.characterId)).toEqual([
      'resident-3',
      'resident-4',
    ]);
    expect(
      next.logs.filter(
        (log) => log.type === 'interaction' && log.characterId === 'resident-1',
      ),
    ).toHaveLength(1);
    expect(
      next.logs.filter(
        (log) => log.type === 'interaction' && log.characterId === 'resident-2',
      ),
    ).toHaveLength(1);
    expect(next.wallet.tokens).toBe(game.wallet.tokens + ACTIVITY.dailyTokens);
    const following = settleDay(next, 2, 'manual');
    expect(
      automaticLogs(following).filter((log) => log.day === 2),
    ).toHaveLength(4);
  });

  it('makes seeded, diverse choices that survive JSON recovery without re-awarding on refresh', () => {
    const choices = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const game = createGame(1000);
      game.randomSeed = seed;
      const a = settleDay(game, 1, 'manual');
      const b = settleDay(structuredClone(game), 1, 'manual');
      expect(a).toEqual(b);
      for (const log of automaticLogs(a)) choices.add(log.actionId!);
      const restored = previewImport(exportArchive(a)).game;
      expect(restored).toEqual(a);
      expect(settleDay(restored, 1, 'manual')).toBe(restored);
    }
    expect(choices).toEqual(new Set(['talk', 'tidy', 'stretch']));
  });

  it('uses leave recovery instead of autonomous actions when stamina is zero', () => {
    const game = createGame(1000);
    for (const character of game.characters) {
      character.stats.energy = 0;
      character.stats.stamina = 0;
    }
    game.wallet.tokens = 0;
    const next = settleDay(game, 1, 'manual');
    expect(automaticLogs(next)).toHaveLength(0);
    expect(
      next.characters.every(
        (character) => character.condition.leaveUntilDay === 8,
      ),
    ).toBe(true);
    for (const character of next.characters) {
      expect(character.stats.energy).toBeGreaterThan(0);
      expect(character.stats.stamina).toBeGreaterThanOrEqual(0);
    }
    expect(gameSchema.safeParse(next).success).toBe(true);
  });

  it('lets observer roommates act independently and always renders automatic actions as ordinary daily life', () => {
    const game = createGame(1000);
    game.player.identity = 'observer';
    const observer = settleDay(game, 1, 'auto');
    expect(automaticLogs(observer)).toHaveLength(4);
    game.player.identity = 'leader';
    game.settings.roleplay = true;
    for (const character of game.characters) character.roleplay = true;
    const next = settleDay(game, 1, 'manual');
    expect(automaticLogs(next)).toHaveLength(4);
    for (const log of automaticLogs(next)) {
      expect(log.actionId).not.toBe('roleplay');
      const text = renderLog(next, log);
      expect(text).toContain('自动日常');
      expect(text).not.toMatch(/主人|男仆|角色扮演/u);
    }
  });

  it('retains the shared +3 budget and the 30-settlement completion boundary', () => {
    let game = createGame(1000);
    game = applyEffects(game, ['resident-1'], { progress: 3 }, 'event').game;
    game = applyEffects(game, ['resident-1'], { progress: -2 }, 'event').game;
    const next = settleDay(game, 1, 'manual');
    expect(next.characters[0]!.stats.progress).toBe(1);
    for (const character of next.characters) {
      expect(character.stats.progress).toBeLessThanOrEqual(3);
      for (const key of statKeys) {
        expect(Number.isInteger(character.stats[key])).toBe(true);
        expect(character.stats[key]).toBeGreaterThanOrEqual(0);
        expect(character.stats[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('uses the same flow for manual/automatic settlement and catches up at most seven daily choices', () => {
    const game = multiRoomGame();
    const manual = settleDay(game, 1, 'manual');
    const auto = settleDay(game, 1, 'auto');
    expect(auto.characters).toEqual(manual.characters);
    expect(automaticLogs(auto)).toEqual(automaticLogs(manual));
    expect(auto.randomSeed).toBe(manual.randomSeed);
    const now = game.clock.anchor + GAME.normalInterval * 12;
    const catchup = advanceTime(game, now, false, true);
    expect(catchup.advanced).toBe(7);
    expect(catchup.discarded).toBe(5);
    expect(automaticLogs(catchup.game)).toHaveLength(7 * 24);
    expect(
      new Set(
        automaticLogs(catchup.game).map(
          (log) => `${log.day}:${log.characterId}`,
        ),
      ).size,
    ).toBe(7 * 24);
    expect(advanceTime(catchup.game, now, false, true).game).toBe(catchup.game);
    expect(
      nextDay(game, 1, game.clock.anchor + GAME.normalInterval, false, true)
        .game.characters,
    ).toEqual(manual.characters);
  });

  it('does not run in setup, repeat a completed daily choice or allow a player to forge an automatic receipt', () => {
    const game = createGame(1000);
    const once = settleIdleInteractions(game);
    expect(settleIdleInteractions(once)).toBe(once);
    game.setup = 'room';
    expect(settleIdleInteractions(game)).toBe(game);
    game.setup = 'done';
    expect(
      interact(game, {
        operationId: `${ACTIVITY.autoInteractionPrefix}1:0`,
        expectedDay: 1,
        characterId: 'resident-1',
        kind: 'normal',
        actionId: 'talk',
      }).game,
    ).toBe(game);
  });
});
