import { describe, expect, it } from 'vitest';
import { GAME } from '../data/constants';
import { MAJORS } from '../data/rules';
import { createBeds, createGame } from './initial';
import { gameSchema, type Character } from './model';
import {
  changeBedType,
  changeStats,
  isComplete,
  moveCharacter,
  naturalDelta,
  settleDay,
  statKeys,
} from './rules';

describe('schema and references', () => {
  it('starts on day 1 with four adult residents, stable unique beds and future fields', () => {
    const game = gameSchema.parse(createGame(1000));
    expect(game.day).toBe(1);
    expect(game.characters).toHaveLength(4);
    expect(new Set(game.characters.map((c) => c.bedId)).size).toBe(4);
    expect(
      game.characters.every(
        (c) => c.age >= 18 && !c.roleplay && c.stats.progress === 0,
      ),
    ).toBe(true);
    expect(game.settings.roleplay).toBe(false);
    expect(game.pendingEvents).toEqual([]);
    expect(game.randomSeed).toBeGreaterThan(0);
  });
  it.each([
    'duplicate-bed',
    'duplicate-character',
    'missing-room',
    'missing-bed',
    'underage',
    'invalid-facility',
    'bad-daily',
    'bad-settlement',
    'bad-level',
    'over-capacity',
    'future-version',
  ])('rejects %s', (kind) => {
    const game = createGame(1000);
    if (kind === 'duplicate-bed')
      game.characters[1]!.bedId = game.characters[0]!.bedId;
    if (kind === 'duplicate-character')
      game.characters[1]!.id = game.characters[0]!.id;
    if (kind === 'missing-room') game.characters[0]!.roomId = 'missing';
    if (kind === 'missing-bed') game.characters[0]!.bedId = 'missing';
    if (kind === 'underage') game.characters[0]!.age = 17;
    if (kind === 'invalid-facility') game.rooms[0]!.facilities.dryWet = true;
    if (kind === 'bad-daily') game.characters[0]!.daily.day = 2;
    if (kind === 'bad-settlement') game.lastSettledDay = 1;
    if (kind === 'bad-level') game.rooms[0]!.beds[0]!.level = 'lower';
    if (kind === 'over-capacity')
      game.characters = Array.from({ length: 25 }, () => game.characters[0]!);
    if (kind === 'future-version') Object.assign(game, { version: '9.0' });
    expect(gameSchema.safeParse(game).success).toBe(false);
  });
  it.each([4, 6, 8] as const)(
    'creates exactly %i real beds in either layout',
    (capacity) => {
      for (const type of ['loft', 'bunk'] as const) {
        const beds = createBeds('test', capacity, type);
        expect(beds).toHaveLength(capacity);
        expect(new Set(beds.map((bed) => bed.id)).size).toBe(capacity);
        if (type === 'bunk')
          expect(beds.filter((bed) => bed.level === 'lower')).toHaveLength(
            capacity / 2,
          );
      }
    },
  );
});

describe('central growth rules', () => {
  it('clamps every stat to integer 0–100 and ignores nonfinite input', () => {
    const character = createGame(1000).characters[0]!;
    for (const key of statKeys) {
      const low = changeStats(character, { [key]: -1000 }, 1);
      const high = changeStats(character, { [key]: 1000.6 }, 1);
      expect(low.stats[key]).toBe(0);
      expect(high.stats[key]).toBe(key === 'progress' ? 3 : 100);
      expect(changeStats(character, { [key]: NaN }, 1).stats[key]).toBe(
        character.stats[key],
      );
    }
  });
  it('shares the +3 budget across sources and does not refund reductions', () => {
    let character = createGame(1000).characters[0]!;
    character = changeStats(character, { progress: 2 }, 1);
    character = changeStats(character, { progress: -2 }, 1);
    character = changeStats(character, { progress: 50 }, 1);
    expect(character.stats.progress).toBe(1);
    expect(character.daily.progressGained).toBe(3);
    expect(changeStats(character, { progress: 1 }, 0)).toBe(character);
    const game = createGame(1000);
    game.characters[0] = character;
    const settled = settleDay(game, 1, 'manual');
    expect(settled.characters[0]!.stats.progress).toBe(1);
    expect(settled.characters[0]!.daily.progressGained).toBe(0);
    expect(
      changeStats(settled.characters[0]!, { progress: 10 }, 2).stats.progress,
    ).toBe(4);
  });
  it('settles a day once, keeps the input immutable and records actual changes', () => {
    const game = createGame(1000);
    const next = settleDay(game, 1, 'manual');
    expect(game.day).toBe(1);
    expect(next.day).toBe(2);
    expect(settleDay(next, 1, 'auto')).toBe(next);
    expect(next.logs.filter((log) => log.type === 'day')).toHaveLength(1);
    expect(next.logs.filter((log) => log.type === 'interaction')).toHaveLength(
      4,
    );
    expect(next.logs).toHaveLength(5);
    expect(next.characters[0]!.growth[0]!.delta.energy).toBe(-3);
    expect(next.characters[0]!.settledDays).toBe(1);
    expect(gameSchema.safeParse(next).success).toBe(true);
  });
  it('requires 100 progress and at least 30 settlements', () => {
    let game = createGame(1000);
    for (let day = 1; day <= 29; day++) game = settleDay(game, day, 'manual');
    expect(game.characters.some(isComplete)).toBe(false);
    expect(game.characters[0]!.stats.progress).toBe(87);
    game = settleDay(game, 30, 'manual');
    expect(isComplete(game.characters[0]!)).toBe(false);
    for (let day = 31; day <= 34; day++) game = settleDay(game, day, 'manual');
    expect(game.characters[0]!.stats.progress).toBe(100);
    expect(isComplete(game.characters[0]!)).toBe(true);
    expect(isComplete({ ...game.characters[0]!, settledDays: 29 })).toBe(false);
  });
  it('bounds all major/facility combinations and keeps daily/custom neutral', () => {
    const game = createGame(1000);
    for (const [major, definition] of Object.entries(MAJORS)) {
      expect(
        Object.values(definition.multipliers).every(
          (value) => value >= 0.8 && value <= 1.3,
        ),
      ).toBe(true);
      for (const bathroom of ['private', 'shared', 'none'] as const) {
        const delta = naturalDelta(
          { ...game.characters[0]!, major: major as Character['major'] },
          {
            ...game.rooms[0]!,
            facilities: { bathroom, dryWet: bathroom === 'private' },
          },
        );
        expect(
          Object.values(delta).every(
            (value) =>
              Number.isInteger(value) && Math.abs(value) <= GAME.naturalLimit,
          ),
        ).toBe(true);
      }
    }
    expect(MAJORS.daily.multipliers).toEqual({});
    expect(MAJORS.custom.multipliers).toEqual({});
  });
  it('bounds retained logs and growth without losing settlement totals', () => {
    let game = createGame(1000);
    for (let day = 1; day <= 305; day++) game = settleDay(game, day, 'manual');
    expect(game.logs).toHaveLength(300);
    expect(game.characters[0]!.growth).toHaveLength(300);
    expect(game.characters[0]!.settledDays).toBe(305);
    expect(gameSchema.safeParse(game).success).toBe(true);
  });
});

describe('bed movement', () => {
  it('atomically swaps occupied beds and leaves stats untouched', () => {
    const game = createGame(1000);
    const moved = moveCharacter(game, 'resident-1', 'room-101-bed-2');
    expect(moved.characters[0]!.bedId).toBe('room-101-bed-2');
    expect(moved.characters[1]!.bedId).toBe('room-101-bed-1');
    expect(moved.characters[0]!.stats).toEqual(game.characters[0]!.stats);
    expect(gameSchema.safeParse(moved).success).toBe(true);
    expect(game.characters[0]!.bedId).toBe('room-101-bed-1');
  });
  it('moves to an empty bed and rejects invalid targets', () => {
    const game = createGame(1000);
    game.characters.pop();
    expect(
      moveCharacter(game, 'resident-1', 'room-101-bed-4').characters[0]!.bedId,
    ).toBe('room-101-bed-4');
    expect(moveCharacter(game, 'resident-1', 'outside')).toBe(game);
    expect(moveCharacter(game, 'outside', 'room-101-bed-2')).toBe(game);
    expect(moveCharacter(game, 'resident-1', 'room-101-bed-1')).toBe(game);
  });
  it('preserves IDs and references while exposing separate upper/lower bunks', () => {
    const game = createGame(1000);
    const bunk = changeBedType(game, 'room-101', 'bunk');
    expect(bunk.characters).toEqual(game.characters);
    expect(bunk.rooms[0]!.beds.map((bed) => bed.level)).toEqual([
      'upper',
      'lower',
      'upper',
      'lower',
    ]);
    expect(gameSchema.safeParse(bunk).success).toBe(true);
    expect(changeBedType(bunk, 'room-101', 'bunk')).toBe(bunk);
  });
});
