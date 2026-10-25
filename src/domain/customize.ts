import { z } from 'zod';
import { GAME } from '../data/constants';
import {
  characterSchema,
  gameSchema,
  playerSchema,
  roomSchema,
  type GameState,
} from './model';
import { createBeds, createGame } from './initial';
import { addLog } from './rules';
import { canManage, identityRules } from './presentation';
import { syncProgress } from './progress';
import { emptyDaily } from './activityState';
import { nextRandom } from './random';
import { MAJORS } from '../data/rules';

export const playerInputSchema = playerSchema.extend({
  adultConfirmed: z.literal(true, { error: '玩家设定无效，请重新创建档案' }),
});
export const roomInputSchema = roomSchema
  .omit({ id: true, beds: true, habitability: true })
  .superRefine((room, ctx) => {
    if (room.facilities.dryWet && room.facilities.bathroom !== 'private')
      ctx.addIssue({ code: 'custom', message: '干湿分离只能搭配独卫' });
  });
export const characterInputSchema = characterSchema
  .pick({
    name: true,
    address: true,
    pronouns: true,
    personality: true,
    age: true,
    major: true,
    customMajor: true,
    tags: true,
    roleplay: true,
    appearance: true,
    roomId: true,
    bedId: true,
  })
  .extend({
    major: z
      .union([characterSchema.shape.major, z.literal('random')])
      .optional(),
    adultConfirmed: z.literal(true, { error: '角色设定无效，请重新创建档案' }),
  });
export type CharacterInput = z.infer<typeof characterInputSchema>;
export type CustomizeCommand =
  | { type: 'player'; input: unknown }
  | { type: 'room'; roomId: string; input: unknown }
  | { type: 'room-create'; input: unknown }
  | {
      type: 'migrate';
      characterId: string;
      fromRoomId: string;
      fromBedId: string;
      roomId: string;
      bedId: string;
    }
  | { type: 'character'; characterId?: string; input: unknown }
  | { type: 'delete'; characterId: string }
  | { type: 'settings'; roleplay: boolean }
  | { type: 'sound'; enabled: boolean }
  | { type: 'finish' };
export interface CustomizeResult {
  game: GameState;
  error?: string;
  entityId?: string;
}

export function customizeGame(
  game: GameState,
  command: CustomizeCommand,
  now: number,
): CustomizeResult {
  const fail = (error: string): CustomizeResult => ({ game, error });
  if (command.type === 'sound') {
    if (typeof command.enabled !== 'boolean') return fail('音效设置无效。');
    return {
      game: { ...game, settings: { ...game.settings, sound: command.enabled } },
    };
  }
  let next = game;
  let entityId = game.slotId;
  let action:
    'player' | 'room' | 'character' | 'delete' | 'settings' | 'welcome';
  if (command.type === 'room-create') {
    if (game.setup !== 'done') return fail('请先完成第一间寝室的入住。');
    if (!canManage(game, 'room'))
      return fail('当前身份不可新建寝室，可先切换管理视角。');
    if (game.rooms.length >= GAME.maxRooms)
      return fail('每个存档最多 6 间寝室。');
    const result = roomInputSchema.safeParse(command.input);
    if (!result.success) return fail(result.error.issues[0]!.message);
    entityId = `room-${crypto.randomUUID()}`;
    const room = {
      id: entityId,
      habitability: GAME.defaultHabitability,
      ...result.data,
      beds: createBeds(entityId, result.data.capacity, result.data.bedType),
    };
    next = {
      ...game,
      rooms: [...game.rooms, room],
      eventProgress: [
        ...game.eventProgress,
        {
          roomId: entityId,
          checkedThrough: game.lastSettledDay,
          seenEventIds: [],
        },
      ],
    };
    action = 'room';
  } else if (command.type === 'migrate') {
    if (game.setup !== 'done' || !canManage(game, 'residents'))
      return fail('当前身份或入住状态不允许搬家。');
    const schema = z.strictObject({
      characterId: characterSchema.shape.id,
      fromRoomId: roomSchema.shape.id,
      fromBedId: characterSchema.shape.bedId,
      roomId: roomSchema.shape.id,
      bedId: characterSchema.shape.bedId,
    });
    const { type, ...input } = command;
    void type;
    const result = schema.safeParse(input);
    if (!result.success) return fail('请选择有效的室友、寝室与床位。');
    const character = game.characters.find(
      (candidate) => candidate.id === result.data.characterId,
    );
    if (
      !character ||
      character.roomId !== result.data.fromRoomId ||
      character.bedId !== result.data.fromBedId
    )
      return fail('室友位置已变化，请重新选择搬家信息。');
    const room = game.rooms.find(
      (candidate) => candidate.id === result.data.roomId,
    );
    if (!room?.beds.some((bed) => bed.id === result.data.bedId))
      return fail('目标寝室或床位不存在。');
    if (room.id === character.roomId)
      return fail('寝室内换床请使用分配 / 交换。');
    if (
      game.characters.filter((candidate) => candidate.roomId === room.id)
        .length >= room.capacity
    )
      return fail('目标寝室已满，原床位保持不变。');
    if (
      game.characters.some((candidate) => candidate.bedId === result.data.bedId)
    )
      return fail('目标床位已被占用，请选择空床。');
    const moved = {
      ...game,
      characters: game.characters.map((candidate) =>
        candidate.id === character.id
          ? { ...candidate, roomId: room.id, bedId: result.data.bedId }
          : candidate,
      ),
    };
    const checked = gameSchema.safeParse(moved);
    if (!checked.success) return fail(checked.error.issues[0]!.message);
    return {
      game: addLog(checked.data, {
        id: crypto.randomUUID(),
        type: 'move',
        day: game.day,
        characterId: character.id,
        from: character.bedId,
        to: result.data.bedId,
        swappedId: null,
      }),
      entityId: character.id,
    };
  } else if (command.type === 'player') {
    const result = playerInputSchema.safeParse(command.input);
    if (!result.success) return fail(result.error.issues[0]!.message);
    const player = playerSchema.strip().parse(result.data);
    next = {
      ...game,
      player,
      setup: game.setup === 'identity' ? 'room' : game.setup,
    };
    if (!identityRules(next).roleplay)
      next = { ...next, settings: { ...next.settings, roleplay: false } };
    action = 'player';
  } else if (command.type === 'room') {
    if (!canManage(game, 'room'))
      return fail('当前身份只可查看寝室配置；可在身份页切换视角。');
    if (game.setup === 'identity') return fail('请先完成身份选择。');
    const result = roomInputSchema.safeParse(command.input);
    if (!result.success) return fail(result.error.issues[0]!.message);
    const room = game.rooms.find(
      (candidate) => candidate.id === command.roomId,
    );
    if (!room) return fail('寝室不存在。');
    const residents = game.characters.filter(
      (character) => character.roomId === room.id,
    );
    if (residents.length > result.data.capacity)
      return fail(
        `当前有 ${residents.length} 位室友，不能缩为 ${result.data.capacity} 人寝。请先调整成员。`,
      );
    const generated = createBeds(
      room.id,
      result.data.capacity,
      result.data.bedType,
    );
    // Keep retained IDs, including IDs from old valid saves; rehome only removed beds.
    const beds = generated.map((bed, index) => ({
      ...bed,
      id: room.beds[index]?.id ?? bed.id,
    }));
    const remaining = new Set(beds.map((bed) => bed.id));
    const occupied = new Set(
      residents
        .filter((character) => remaining.has(character.bedId))
        .map((character) => character.bedId),
    );
    const free = beds
      .filter((bed) => !occupied.has(bed.id))
      .map((bed) => bed.id);
    const characters = game.characters.map((character) =>
      character.roomId === room.id && !remaining.has(character.bedId)
        ? { ...character, bedId: free.shift()! }
        : character,
    );
    next = {
      ...game,
      setup: game.setup === 'room' ? 'characters' : game.setup,
      rooms: game.rooms.map((candidate) =>
        candidate.id === room.id
          ? {
              id: room.id,
              ...result.data,
              beds,
              habitability: room.habitability,
            }
          : candidate,
      ),
      characters,
    };
    entityId = room.id;
    action = 'room';
  } else if (command.type === 'character') {
    if (!canManage(game, 'residents'))
      return fail('当前身份只可查看室友档案；可在身份页切换视角。');
    if (game.setup === 'identity' || game.setup === 'room')
      return fail('请先选择身份并保存寝室配置。');
    const result = characterInputSchema.safeParse(command.input);
    if (!result.success) return fail(result.error.issues[0]!.message);
    const draft = characterInputSchema
      .omit({ adultConfirmed: true })
      .strip()
      .parse(result.data);
    const random = draft.major === 'random' || draft.major === undefined;
    const seed = random ? nextRandom(game.randomSeed) : game.randomSeed;
    const majors = Object.keys(MAJORS).filter(
      (id) => id !== 'custom' && id !== 'daily',
    ) as Array<
      Exclude<GameState['characters'][number]['major'], 'custom' | 'daily'>
    >;
    const input = {
      ...draft,
      major: random
        ? majors[seed % majors.length]!
        : (draft.major as GameState['characters'][number]['major']),
    };
    const old = command.characterId
      ? game.characters.find(
          (character) => character.id === command.characterId,
        )
      : undefined;
    if (command.characterId && !old) return fail('室友不存在，请重新选择。');
    if (!old && game.characters.length >= GAME.maxCharacters)
      return fail('全局最多 24 名常住室友。');
    const room = game.rooms.find((candidate) => candidate.id === input.roomId);
    if (!room?.beds.some((bed) => bed.id === input.bedId))
      return fail('请选择当前寝室的有效床位。');
    if (old && old.roomId !== input.roomId)
      return fail('跨寝室请使用搬家操作，避免编辑档案时意外改变位置。');
    const occupant = game.characters.find(
      (character) =>
        character.bedId === input.bedId && character.id !== old?.id,
    );
    if (occupant && !old) return fail('该床位已有室友，请选择空床。');
    if (input.roleplay && !identityRules(game).roleplay)
      return fail('当前身份具有现实管理关系，不参与关系扮演。');
    entityId = old?.id ?? crypto.randomUUID();
    const template = createGame(now).characters[0]!;
    let character = old
      ? { ...old, ...input }
      : {
          ...template,
          ...input,
          id: entityId,
          daily: emptyDaily(game.day),
        };
    if (character.tags.includes('男娘') && !character.tagProgressGranted)
      character = {
        ...character,
        tagProgressGranted: true,
        stats: {
          ...character.stats,
          progress: Math.max(character.stats.progress, GAME.tagInitialProgress),
        },
      };
    let characters = game.characters.map((candidate) =>
      candidate.id === old?.id
        ? character
        : occupant && candidate.id === occupant.id
          ? { ...candidate, bedId: old!.bedId }
          : candidate,
    );
    if (!old) characters = [...characters, character];
    next = { ...game, characters, randomSeed: seed };
    action = 'character';
  } else if (command.type === 'delete') {
    if (!canManage(game, 'residents')) return fail('当前身份不可移除室友。');
    if (
      !game.characters.some((character) => character.id === command.characterId)
    )
      return fail('室友不存在。');
    if (game.setup === 'done' && game.characters.length === 1)
      return fail('请至少保留一名室友，或先添加新的室友。');
    next = {
      ...game,
      characters: game.characters.filter(
        (character) => character.id !== command.characterId,
      ),
      pendingEvents: game.pendingEvents.filter(
        (event) => !event.characterIds.includes(command.characterId),
      ),
    };
    entityId = command.characterId;
    action = 'delete';
  } else if (command.type === 'settings') {
    if (typeof command.roleplay !== 'boolean') return fail('开关设置无效。');
    if (command.roleplay && !identityRules(game).roleplay)
      return fail('当前身份不参与关系扮演。');
    next = {
      ...game,
      settings: { ...game.settings, roleplay: command.roleplay },
    };
    action = 'settings';
  } else {
    if (game.setup !== 'characters' || !game.characters.length)
      return fail('请先完成身份、寝室配置并创建至少一位室友。');
    next = {
      ...game,
      setup: 'done',
      clock: { ...game.clock, anchor: now, lastObserved: now },
    };
    action = 'welcome';
  }
  const checked = gameSchema.safeParse(next);
  if (!checked.success) return fail(checked.error.issues[0]!.message);
  return {
    game: addLog(syncProgress(checked.data), {
      id: crypto.randomUUID(),
      type: 'customize',
      day: game.day,
      action,
      entityId,
    }),
    entityId,
  };
}
