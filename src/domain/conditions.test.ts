import { describe, expect, it } from 'vitest';
import { createGame } from './initial';
import { resolveConditions, onLeave } from './conditions';
import { applyEffects } from './effects';
import { customizeGame } from './customize';
import { residentInput } from '../test/multiRoom';
import { settleDay, renderLog } from './rules';
import { interact, interactionOffer } from './interactions';
import { changeWardrobe } from './wardrobe';
import { syncProgress } from './progress';
import { gameSchema, styleSaveSchema, type GameState } from './model';
import { chooseEvent, eligibleEventResidents } from './events';
import { CAMPUS_EVENTS } from '../data/events';
import { queuedEvent } from '../test/eventGame';
import { performIdentityAction } from './identityActions';
import { advanceTime } from './time';
import { GAME } from '../data/constants';
import { exportArchive, previewImport } from './saves';
import { encodeCompact } from './compactSave';

function profile(game: GameState, tags: string[]) {
  return {
    ...residentInput(game, game.rooms[0]!.id, game.characters[0]!.bedId),
    tags,
  };
}
describe('one-time tag starting progress', () => {
  it.each([{ tags: [] }, { tags: ['可爱'] }, { tags: ['男娘'] }])(
    'initializes a new resident with tags %j',
    ({ tags }) => {
      const game = createGame(1000);
      const input = profile(game, tags);
      game.characters = [];
      game.setup = 'characters';
      const result = customizeGame(game, { type: 'character', input }, 1000);
      expect(result.error).toBeUndefined();
      const actor = result.game.characters[0]!;
      expect(actor.stats.progress).toBe(tags.includes('男娘') ? 50 : 0);
      expect(actor.tagProgressGranted).toBe(tags.includes('男娘'));
      expect(actor.daily.progressGained).toBe(0);
      expect(actor.settledDays).toBe(0);
      if (tags.includes('男娘'))
        expect(result.game.wardrobe.unlockedIds).toContain('petal-skirt');
    },
  );
  it('grants first selection only once and never refunds mood losses through editing or toggling', () => {
    let game = createGame(1000);
    const edit = (tags: string[]) => {
      const result = customizeGame(
        game,
        {
          type: 'character',
          characterId: 'resident-1',
          input: profile(game, tags),
        },
        1000,
      );
      expect(result.error).toBeUndefined();
      game = result.game;
    };
    edit(['男娘']);
    expect(game.characters[0]!.stats.progress).toBe(50);
    game = applyEffects(game, ['resident-1'], { mood: -100 }, 'event').game;
    expect(game.characters[0]!.stats.progress).toBe(25);
    edit([]);
    edit(['男娘']);
    expect(game.characters[0]!.stats.progress).toBe(25);
    game = applyEffects(game, ['resident-1'], { progress: 100 }, 'event').game;
    expect(game.characters[0]!.stats.progress).toBe(28);
    expect(game.characters[0]!.daily.progressGained).toBe(3);
  });
});
describe('zero-state consequences and recovery', () => {
  it('starts seven game days of leave immediately when an actual interaction spends the last stamina', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.stamina = 4;
    const result = interact(game, {
      operationId: 'last-stamina',
      expectedDay: 1,
      characterId: 'resident-1',
      kind: 'normal',
      actionId: 'tidy',
    });
    expect(result.error).toBeUndefined();
    expect(result.game.characters[0]!.stats.stamina).toBe(0);
    expect(result.game.characters[0]!.condition.leaveUntilDay).toBe(8);
    expect(
      interactionOffer(
        result.game,
        result.game.characters[0]!,
        'normal',
        'talk',
      ).error,
    ).toContain('请假');
    expect(
      interactionOffer(result.game, result.game.characters[0]!, 'gift', 'tea')
        .error,
    ).toContain('请假');
    expect(
      result.game.logs.some(
        (log) => log.type === 'condition' && log.reason === 'stamina',
      ),
    ).toBe(true);
    expect(gameSchema.safeParse(result.game).success).toBe(true);
  });
  it('pauses all growth and random participation for seven settlements, recovers safely, then returns', () => {
    let game = createGame(1000);
    game.characters = [game.characters[0]!];
    game = applyEffects(game, ['resident-1'], { stamina: -100 }, 'event').game;
    const start = game.characters[0]!.stats.progress;
    for (let day = 1; day <= 7; day++) {
      expect(onLeave(game.characters[0]!, game.day)).toBe(true);
      game = settleDay(game, game.day, 'manual');
      expect(game.characters[0]!.stats.progress).toBe(start);
      expect(game.pendingEvents).toEqual([]);
      expect(game.logs.filter((log) => log.type === 'interaction')).toEqual([]);
      expect(gameSchema.safeParse(game).success).toBe(true);
    }
    expect(game.day).toBe(8);
    expect(onLeave(game.characters[0]!, game.day)).toBe(false);
    expect(game.characters[0]!.stats.stamina).toBe(84);
    expect(
      game.logs.filter(
        (log) => log.type === 'condition' && log.reason === 'stamina',
      ),
    ).toHaveLength(1);
    game = settleDay(game, 8, 'manual');
    expect(game.characters[0]!.stats.progress).toBe(start + 3);
  });
  it('halves mood-breakdown losses once, preserves earned progress quota and safely stores restricted clothing', () => {
    let game = createGame(1000);
    game.characters[0]!.stats.progress = 100;
    game.characters[0]!.stats.affection = 41;
    game.characters[0]!.daily.progressGained = 3;
    game = changeWardrobe(syncProgress(game), {
      type: 'maid-set',
      characterId: 'resident-1',
    }).game;
    game = applyEffects(game, ['resident-1'], { mood: -100 }, 'event').game;
    const actor = game.characters[0]!;
    expect(actor.stats).toMatchObject({ affection: 20, progress: 50, mood: 0 });
    expect(actor.outfit).toMatchObject({
      top: 'basic-top',
      skirt: null,
      accessory: null,
      makeup: null,
    });
    expect(game.wardrobe.unlockedIds).toContain('maid-skirt');
    expect(actor.daily.progressGained).toBe(3);
    expect(resolveConditions(game)).toBe(game);
    const log = game.logs.find(
      (log) => log.type === 'condition' && log.reason === 'mood',
    )!;
    expect(renderLog(game, log)).toContain('减半');
    expect(gameSchema.safeParse(game).success).toBe(true);
    expect(previewImport(exportArchive(game)).game).toEqual(game);
    expect(
      previewImport(encodeCompact({ revision: 1, commitId: 'penalty', game }))
        .game,
    ).toEqual(game);
    game = applyEffects(game, ['resident-1'], { mood: 10 }, 'event').game;
    game = applyEffects(game, ['resident-1'], { mood: -10 }, 'event').game;
    expect(game.characters[0]!.stats.progress).toBe(25);
    expect(
      game.logs.filter(
        (log) => log.type === 'condition' && log.reason === 'mood',
      ),
    ).toHaveLength(2);
  });
  it('chains exhausted energy into a mood breakdown and rounds odd stats down without repeated deductions', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.mood = 5;
    game.characters[0]!.stats.progress = 99;
    game.characters[0]!.stats.affection = 43;
    const next = applyEffects(
      game,
      ['resident-1'],
      { energy: -100 },
      'event',
    ).game;
    expect(next.characters[0]!.stats).toMatchObject({
      progress: 49,
      affection: 21,
      mood: 0,
      energy: 0,
      rapport: 28,
    });
    expect(next.logs.filter((log) => log.type === 'condition')).toHaveLength(2);
    expect(resolveConditions(next)).toBe(next);
  });
  it('excludes resting residents from group costs and events and holds their pending decisions', () => {
    let game = queuedEvent('ribbon-studio');
    const pending = game.pendingEvents.find(
      (pending) => pending.eventId === 'ribbon-studio',
    )!;
    const id = pending.characterIds[0]!;
    game = applyEffects(game, [id], { stamina: -100 }, 'event').game;
    const before = game.characters.find((row) => row.id === id)!;
    expect(
      chooseEvent(game, { instanceId: pending.id, choiceId: 'photo' }).game,
    ).toBe(game);
    for (const event of CAMPUS_EVENTS)
      expect(
        eligibleEventResidents(game, game.rooms[0]!, event, game.day).some(
          (row) => row.id === id,
        ),
      ).toBe(false);
    const grouped = performIdentityAction(game, {
      actionId: 'cleanup',
      operationId: 'healthy-group',
      expectedDay: game.day,
      identity: 'leader',
      roomId: game.rooms[0]!.id,
    });
    expect(grouped.error).toBeUndefined();
    expect(grouped.game.characters.find((row) => row.id === id)).toEqual(
      before,
    );
    expect(grouped.game.logs.at(-1)).toMatchObject({
      type: 'identity',
      results: expect.any(Array),
    });
    const log = grouped.game.logs.at(-1)!;
    if (log.type === 'identity') expect(log.results).toHaveLength(3);
  });
  it('uses the same seven-day recovery during capped offline catch-up, with stale settlement remaining a no-op', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.stamina = 0;
    const result = advanceTime(
      game,
      1000 + GAME.normalInterval * 10,
      false,
      true,
    );
    expect(result.advanced).toBe(7);
    expect(result.game.characters[0]!.stats.progress).toBe(0);
    expect(onLeave(result.game.characters[0]!, result.game.day)).toBe(false);
    expect(settleDay(result.game, 1, 'manual')).toBe(result.game);
  });
});
describe('strict 1.5 migration and real positive/negative stories', () => {
  it('migrates old tags once without resetting higher progress, and preserves subsequent losses on reimport', () => {
    const game = createGame(1000);
    game.characters[0]!.tags = ['男娘'];
    game.characters[1]!.tags = ['男娘'];
    game.characters[1]!.stats.progress = 88;
    const old = {
      revision: 1,
      commitId: 'before-consequences',
      game: {
        ...game,
        version: '1.5',
        characters: game.characters.map(
          ({ condition, tagProgressGranted, ...character }) => {
            void condition;
            void tagProgressGranted;
            return character;
          },
        ),
      },
    };
    expect(styleSaveSchema.safeParse(old).success).toBe(true);
    const raw = JSON.stringify(old);
    let migrated = previewImport(raw).game;
    expect(migrated.characters.map((row) => row.stats.progress)).toEqual([
      50, 88, 0, 0,
    ]);
    migrated = applyEffects(
      migrated,
      ['resident-1'],
      { mood: -100 },
      'event',
    ).game;
    expect(
      previewImport(exportArchive(migrated)).game.characters[0]!.stats.progress,
    ).toBe(25);
    expect(JSON.stringify(old)).toBe(raw);
    const invalid = structuredClone(old);
    invalid.game.characters[0]!.bedId = 'missing';
    expect(() => previewImport(JSON.stringify(invalid))).toThrow();
  });
  it.each([
    'campus-lucky-draw',
    'sunny-walk',
    'outfit-compliment',
    'deadline-surprise',
    'water-spill',
    'missing-key',
  ])(
    'actually schedules and applies %s from a reproducible seed',
    (eventId) => {
      const definition = CAMPUS_EVENTS.find((row) => row.id === eventId)!;
      let found = false;
      for (let seed = 1; seed <= 500 && !found; seed++) {
        let game = createGame(1000);
        game.randomSeed = seed;
        game = settleDay(game, 1, 'manual');
        game = settleDay(game, 2, 'manual');
        const log = game.logs.find(
          (log) => log.type === 'event' && log.eventId === eventId,
        );
        if (log?.type !== 'event') continue;
        found = true;
        expect(log.choiceId).toBe(definition.outcomes[0]!.id);
        expect(gameSchema.safeParse(game).success).toBe(true);
        if (eventId === 'water-spill') expect(log.habitabilityDelta).toBe(-8);
        if (eventId === 'missing-key') expect(log.tokenDelta).toBe(-4);
        const changes = Object.values(log.results[0]!.delta);
        expect(changes.some((value) => value !== 0)).toBe(true);
        expect(changes.some((value) => value < 0)).toBe(
          ['deadline-surprise', 'water-spill', 'missing-key'].includes(eventId),
        );
      }
      expect(found).toBe(true);
    },
  );
});
