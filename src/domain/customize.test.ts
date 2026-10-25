import { oldM3Game } from '../test/oldSave';
import { describe, expect, it } from 'vitest';
import { createBeds, createGame, createNewGame } from './initial';
import {
  customizeGame,
  type CharacterInput,
  type CustomizeCommand,
} from './customize';
import { gameSchema, type GameState } from './model';
import { canManage, roleplayEnabled, statLabel } from './presentation';
import { renderLog, settleDay } from './rules';
import { decodeSave } from './migrations';
import { isAdultText } from './adultText';

function execute(game: GameState, command: CustomizeCommand) {
  const result = customizeGame(game, command, 2000);
  expect(result.error).toBeUndefined();
  expect(gameSchema.safeParse(result.game).success).toBe(true);
  return result.game;
}
function profile(
  game: GameState,
  bedId = game.rooms[0]!.beds[0]!.id,
): CharacterInput {
  const resident = createGame(1000).characters[0]!;
  return {
    name: '桃桃',
    address: '桃桃',
    pronouns: '他',
    personality: '安静的成年大学生',
    age: 20,
    major: 'daily',
    customMajor: '',
    tags: ['男娘', '可爱'],
    roleplay: false,
    appearance: resident.appearance,
    roomId: game.rooms[0]!.id,
    bedId,
    adultConfirmed: true,
  };
}
function player(identity: GameState['player']['identity'] = 'leader') {
  return {
    identity,
    customTitle: identity === 'custom' ? '周末朋友' : '',
    age: 20,
    adultConfirmed: true,
  };
}
describe('M2 creation and editing', () => {
  it('completes identity → room → adult roommate → move-in without making the player occupy a bed', () => {
    let game = createNewGame(1000);
    expect(game.characters).toHaveLength(0);
    expect(customizeGame(game, { type: 'finish' }, 2000).error).toBeTruthy();
    game = execute(game, { type: 'player', input: player('member') });
    expect(game.setup).toBe('room');
    game = execute(game, {
      type: 'room',
      roomId: game.rooms[0]!.id,
      input: {
        name: '奶油樱花寝室',
        capacity: 6,
        bedType: 'bunk',
        facilities: { bathroom: 'private', dryWet: true },
      },
    });
    game = execute(game, { type: 'character', input: profile(game) });
    expect(game.characters).toHaveLength(1);
    expect(game.characters[0]!.stats.progress).toBe(50);
    game = execute(game, { type: 'finish' });
    expect(game.setup).toBe('done');
    expect(game.clock.anchor).toBe(2000);
    expect(canManage(game, 'room')).toBe(false);
    expect(canManage(game, 'residents')).toBe(true);
  });
  it('keeps duplicate names with unique IDs and prevents an occupied-bed creation', () => {
    let game = createGame(1000);
    game.characters = [];
    game = execute(game, { type: 'character', input: profile(game) });
    const occupied = customizeGame(
      game,
      { type: 'character', input: profile(game) },
      2000,
    );
    expect(occupied.error).toContain('已有室友');
    expect(occupied.game).toBe(game);
    game = execute(game, {
      type: 'character',
      input: profile(game, game.rooms[0]!.beds[1]!.id),
    });
    expect(game.characters[0]!.name).toBe(game.characters[1]!.name);
    expect(game.characters[0]!.id).not.toBe(game.characters[1]!.id);
  });
  it('keeps growth, appearance and IDs while editing and swaps an occupied target atomically', () => {
    const game = settleDay(createGame(1000), 1, 'manual');
    const original = game.characters[0]!;
    const next = execute(game, {
      type: 'character',
      characterId: original.id,
      input: {
        ...profile(game, game.characters[1]!.bedId),
        name: '桃花',
        appearance: { ...original.appearance, topColor: '#ff88bb' },
      },
    });
    expect(next.characters[0]!.stats).toEqual({
      ...original.stats,
      progress: 50,
    });
    expect(next.characters[0]!.growth).toEqual(original.growth);
    expect(next.characters[0]!.id).toBe(original.id);
    expect(next.characters[1]!.bedId).toBe(original.bedId);
  });
  it('rejects contradictory facilities and overfull shrinking without changing the input', () => {
    const game = createGame(1000);
    const input = {
      name: '樱花屋',
      capacity: 4,
      bedType: 'loft',
      facilities: { bathroom: 'shared', dryWet: true },
    };
    expect(
      customizeGame(
        game,
        { type: 'room', roomId: game.rooms[0]!.id, input },
        2000,
      ).game,
    ).toBe(game);
    let expanded = execute(game, {
      type: 'room',
      roomId: game.rooms[0]!.id,
      input: {
        ...input,
        capacity: 6,
        facilities: { bathroom: 'shared', dryWet: false },
      },
    });
    expanded = execute(expanded, {
      type: 'character',
      input: profile(expanded, expanded.rooms[0]!.beds[4]!.id),
    });
    const rejected = customizeGame(
      expanded,
      {
        type: 'room',
        roomId: game.rooms[0]!.id,
        input: { ...input, facilities: { bathroom: 'shared', dryWet: false } },
      },
      2000,
    );
    expect(rejected.error).toContain('不能缩为');
    expect(rejected.game).toBe(expanded);
  });
  it('rehomes removed beds safely when shrinking and frees deleted resident references', () => {
    let game = createGame(1000);
    game.rooms[0]!.capacity = 8;
    game.rooms[0]!.beds = createBeds(game.rooms[0]!.id, 8, 'loft');
    game.characters[0]!.bedId = game.rooms[0]!.beds[7]!.id;
    game = execute(game, {
      type: 'room',
      roomId: game.rooms[0]!.id,
      input: {
        name: '小寝室',
        capacity: 4,
        bedType: 'bunk',
        facilities: { bathroom: 'none', dryWet: false },
      },
    });
    expect(game.characters[0]!.bedId).toBe(game.rooms[0]!.beds[0]!.id);
    game.pendingEvents = [
      {
        id: 'pending-1',
        eventId: 'example',
        roomId: game.rooms[0]!.id,
        day: game.day,
        characterIds: [game.characters[0]!.id],
      },
    ];
    game = execute(game, {
      type: 'delete',
      characterId: game.characters[0]!.id,
    });
    expect(game.characters).toHaveLength(3);
    expect(game.pendingEvents).toEqual([]);
  });
  it.each([4, 6, 8] as const)(
    'renders %i actual beds and rejects creating beyond capacity',
    (capacity) => {
      let game = createGame(1000);
      game.setup = 'characters';
      game.characters = [];
      game = execute(game, {
        type: 'room',
        roomId: game.rooms[0]!.id,
        input: {
          name: '樱花寝室',
          capacity,
          bedType: 'bunk',
          facilities: { bathroom: 'private', dryWet: true },
        },
      });
      for (const bed of game.rooms[0]!.beds)
        game = execute(game, {
          type: 'character',
          input: profile(game, bed.id),
        });
      expect(game.characters).toHaveLength(capacity);
      expect(
        customizeGame(game, { type: 'character', input: profile(game) }, 2000)
          .error,
      ).toBeTruthy();
    },
  );
  it('enforces the global 24-person maximum even if a room has a free bed', () => {
    const game = createGame(1000);
    const template = game.characters[0]!;
    game.rooms = Array.from({ length: 4 }, (_, index) => ({
      ...game.rooms[0]!,
      id: `room-${index}`,
      beds: createBeds(`room-${index}`, 8, 'loft'),
      capacity: 8,
    }));
    game.characters = game.rooms.slice(0, 3).flatMap((room, index) =>
      room.beds.map((bed, bedIndex) => ({
        ...template,
        id: `c-${index}-${bedIndex}`,
        roomId: room.id,
        bedId: bed.id,
      })),
    );
    expect(gameSchema.safeParse(game).success).toBe(true);
    const result = customizeGame(
      game,
      {
        type: 'character',
        input: {
          ...profile(game),
          roomId: game.rooms[3]!.id,
          bedId: game.rooms[3]!.beds[0]!.id,
        },
      },
      2000,
    );
    expect(result.error).toContain('24');
    expect(result.game).toBe(game);
  });
  it.each(['17 岁的朋友', '十七岁的室友', '高中生', '未成年人', '小学生'])(
    'blocks underage free-text: %s',
    (name) => {
      const game = createGame(1000);
      const result = customizeGame(
        game,
        {
          type: 'character',
          characterId: game.characters[0]!.id,
          input: { ...profile(game), name },
        },
        2000,
      );
      expect(result.error).toBeTruthy();
      expect(result.game).toBe(game);
    },
  );
  it('accepts adult expressions and rejects unconfirmed or numeric underage profiles', () => {
    expect(isAdultText('二十七岁的朋友')).toBe(true);
    expect(isAdultText('十八岁的成年人')).toBe(true);
    const game = createGame(1000);
    for (const override of [
      { age: 17 },
      { adultConfirmed: false },
      { name: 'x'.repeat(41) },
    ])
      expect(
        customizeGame(
          game,
          {
            type: 'character',
            characterId: game.characters[0]!.id,
            input: { ...profile(game), ...override },
          },
          2000,
        ).error,
      ).toBeTruthy();
  });
});

describe('consent and identity presentation', () => {
  it('requires both switches and rerenders historical labels without changing rapport', () => {
    let game = settleDay(createGame(1000), 1, 'manual');
    game.characters[0]!.roleplay = true;
    const rapport = game.characters[0]!.stats.rapport;
    const log = game.logs[0]!;
    expect(roleplayEnabled(game, game.characters[0]!)).toBe(false);
    game = execute(game, { type: 'settings', roleplay: true });
    expect(statLabel(game, game.characters[0], 'rapport')).toBe('听话值');
    expect(statLabel(game, game.characters[1], 'rapport')).toBe('默契值');
    expect(renderLog(game, log)).toContain('听话值');
    game = execute(game, { type: 'settings', roleplay: false });
    expect(renderLog(game, log)).not.toContain('听话值');
    expect(game.characters[0]!.stats.rapport).toBe(rapport);
    game = execute(game, { type: 'settings', roleplay: true });
    game.characters[0]!.roleplay = false;
    expect(renderLog(game, log)).not.toContain('听话值');
  });
  it.each(['parent', 'warden', 'manager', 'counselor'] as const)(
    'disallows roleplay for %s and keeps player out of resident count',
    (identity) => {
      const game = execute(createGame(1000), {
        type: 'player',
        input: player(identity),
      });
      expect(
        customizeGame(game, { type: 'settings', roleplay: true }, 2000).error,
      ).toBeTruthy();
      expect(game.characters).toHaveLength(4);
    },
  );
  it('does not bypass authority restrictions through a custom identity name', () => {
    const game = execute(createGame(1000), {
      type: 'player',
      input: { ...player('custom'), customTitle: '宿管老师' },
    });
    expect(
      customizeGame(game, { type: 'settings', roleplay: true }, 2000).error,
    ).toBeTruthy();
  });
});

describe('M1 save compatibility', () => {
  function legacy() {
    const game = oldM3Game(settleDay(createGame(1000), 1, 'manual'));
    const { setup, ...rest } = game;
    void setup;
    const { customTitle, ...oldPlayer } = game.player;
    void customTitle;
    return {
      revision: 3,
      commitId: 'm1-original',
      game: {
        ...rest,
        version: '1.0',
        player: oldPlayer,
        characters: game.characters.map(({ customMajor, ...character }) => {
          void customMajor;
          const { bottomColor, ...appearance } = character.appearance;
          void bottomColor;
          return { ...character, appearance };
        }),
      },
    };
  }
  it('validates 1.0 before migration, preserves progress and beds, and marks old games ready', () => {
    const original = legacy();
    const raw = JSON.stringify(original);
    const migrated = decodeSave(original);
    expect(migrated.game.version).toBe('1.6');
    expect(migrated.game.setup).toBe('done');
    expect(migrated.game.characters[0]!.stats).toEqual(
      original.game.characters[0]!.stats,
    );
    expect(migrated.game.day).toBe(2);
    expect(JSON.stringify(original)).toBe(raw);
  });
  it('rejects bad references, unknown old fields and future versions before replacing anything', () => {
    const bad = legacy();
    bad.game.characters[0]!.bedId = 'missing';
    expect(() => decodeSave(bad)).toThrow();
    const extra = legacy();
    Object.assign(extra.game, { futureField: true });
    expect(() => decodeSave(extra)).toThrow();
    const future = legacy();
    future.game.version = '9.0';
    expect(() => decodeSave(future)).toThrow();
  });
});
