import { z } from 'zod';
import { ACTIVITY, GAME } from '../data/constants';
import { isAdultText } from './adultText';
import {
  findClothing,
  CORE_SLOTS,
  OPEN_SLOTS,
  WARDROBE,
} from '../data/clothes';
import { FACE_IDS } from '../data/faces';
import { findIdentityAction } from '../data/identityActions';
import { CAMPUS_EVENTS, findEvent } from '../data/events';
import { GIFT_IDS, INTERACTION_IDS } from '../data/interactions';

const id = z.string().min(1).max(80);
const text = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine(isAdultText, '请使用大学校园角色设定');
const optionalText = z
  .string()
  .trim()
  .max(40)
  .refine(isAdultText, '请使用大学校园设定');
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const color = z.string().regex(/^#[0-9a-f]{6}$/iu);
const stat = z.number().int().min(GAME.statMin).max(GAME.statMax);
export const statsSchema = z.strictObject({
  affection: stat,
  mood: stat,
  stamina: stat,
  energy: stat,
  progress: stat,
  rapport: stat,
});
export type Stats = z.infer<typeof statsSchema>;
export type StatKey = keyof Stats;
export const majorSchema = z.enum([
  'daily',
  'computing',
  'art',
  'sport',
  'literature',
  'medicine',
  'music',
  'custom',
]);
export const bedTypeSchema = z.enum(['loft', 'bunk']);
export type BedType = z.infer<typeof bedTypeSchema>;
export const outfitSchema = z.strictObject({
  hair: id,
  top: id,
  bottom: id,
  skirt: id.nullable(),
  coat: id.nullable(),
  shoes: id.nullable(),
  socks: id.nullable(),
  accessory: id.nullable(),
  makeup: id.nullable(),
});
export const outfitColorsSchema = z.strictObject({
  hairColor: color,
  topColor: color,
  bottomColor: color,
});
export const appearanceSchema = outfitColorsSchema.extend({
  skinColor: color,
  face: z.enum(FACE_IDS),
});
const presetSchema = z.strictObject({
  id,
  name: text,
  outfit: outfitSchema,
  colors: outfitColorsSchema,
});
export const signedStatsSchema = z.strictObject({
  affection: z.number().int(),
  mood: z.number().int(),
  stamina: z.number().int(),
  energy: z.number().int(),
  progress: z.number().int(),
  rapport: z.number().int(),
});
const activityTotalsSchema = z.strictObject({
  interaction: signedStatsSchema,
  event: signedStatsSchema,
});
const oldDailySchema = z.strictObject({
  day: count,
  progressGained: z.number().int().min(0).max(GAME.dailyProgress),
  interactions: count,
  gifts: count,
});
const growthSchema = z.strictObject({
  day: count,
  delta: signedStatsSchema.partial(),
  source: z.enum(['natural', 'interaction', 'event']),
});
export const characterSchema = z.strictObject({
  id,
  name: text,
  address: text,
  pronouns: text,
  personality: text,
  age: z.number().int().min(18).max(120),
  major: majorSchema,
  customMajor: optionalText,
  tags: z.array(text).max(12),
  tagProgressGranted: z.boolean(),
  condition: z.strictObject({
    leaveUntilDay: count,
    staminaZero: z.boolean(),
    moodZero: z.boolean(),
    energyZero: z.boolean(),
  }),
  roleplay: z.boolean(),
  appearance: appearanceSchema,
  outfit: outfitSchema,
  roomId: id,
  bedId: id,
  stats: statsSchema,
  settledDays: count,
  daily: oldDailySchema.extend({
    identityParticipated: z.boolean(),
    interactions: z.number().int().min(0).max(ACTIVITY.interactionsPerDay),
    gifts: z.number().int().min(0).max(ACTIVITY.giftsPerDay),
    operationIds: z
      .array(id)
      .max(ACTIVITY.interactionsPerDay + ACTIVITY.giftsPerDay),
    changes: activityTotalsSchema,
  }),
  growth: z.array(growthSchema).max(GAME.maxLogs),
});
export type Character = z.infer<typeof characterSchema>;
export const portraitSchema = characterSchema.pick({
  id: true,
  name: true,
  major: true,
  appearance: true,
  outfit: true,
});
const oldLegacySchema = z.strictObject({
  runs: count,
  achievements: z.array(id).max(1000),
  encyclopedia: z.array(id).max(1000),
});
export const roomSchema = z.strictObject({
  id,
  name: text,
  habitability: stat,
  capacity: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  bedType: bedTypeSchema,
  beds: z
    .array(
      z.strictObject({
        id,
        unit: z.number().int().min(1).max(8),
        level: z.enum(['loft', 'upper', 'lower']),
      }),
    )
    .max(8),
  facilities: z.strictObject({
    bathroom: z.enum(['private', 'shared', 'none']),
    dryWet: z.boolean(),
  }),
});
export type Room = z.infer<typeof roomSchema>;
const oldDayResultSchema = z.strictObject({
  characterId: id,
  delta: signedStatsSchema,
  major: majorSchema,
  bathroom: z.enum(['private', 'shared', 'none']),
});
const effectResultSchema = z.strictObject({
  characterId: id,
  delta: signedStatsSchema,
  major: majorSchema,
});
export const logSchema = z.discriminatedUnion('type', [
  z.strictObject({
    id,
    type: z.literal('customize'),
    day: count,
    action: z.enum([
      'player',
      'room',
      'character',
      'delete',
      'settings',
      'welcome',
    ]),
    entityId: id,
  }),
  z.strictObject({
    id,
    type: z.literal('day'),
    day: count,
    source: z.enum(['manual', 'auto']),
    allowance: z.number().int().min(0).max(ACTIVITY.dailyTokens),
    results: z
      .array(
        oldDayResultSchema.extend({
          dryWet: z.boolean().nullable(),
          activity: activityTotalsSchema,
        }),
      )
      .max(GAME.maxCharacters),
  }),
  z.strictObject({
    id,
    type: z.literal('move'),
    day: count,
    characterId: id,
    from: id,
    to: id,
    swappedId: id.nullable(),
  }),
  z.strictObject({
    id,
    type: z.literal('layout'),
    day: count,
    roomId: id,
    bedType: bedTypeSchema,
  }),
  z.strictObject({
    id,
    type: z.literal('wardrobe'),
    day: count,
    action: z.enum([
      'equip',
      'color',
      'random',
      'preset-save',
      'preset-apply',
      'preset-delete',
      'unlock',
    ]),
    characterId: id.nullable(),
    itemIds: z.array(id).max(1000),
    presetName: text.nullable(),
  }),
  z.strictObject({
    id,
    type: z.literal('interaction'),
    day: count,
    characterId: id,
    actionId: z.enum(INTERACTION_IDS).nullable(),
    giftId: z.enum(GIFT_IDS).nullable(),
    delta: signedStatsSchema,
    major: majorSchema,
    cost: z.strictObject({ energy: count, stamina: count, tokens: count }),
  }),
  z.strictObject({
    id,
    type: z.literal('event'),
    habitabilityDelta: z.number().int().min(-100).max(100).optional(),
    day: count,
    triggerDay: count,
    instanceId: id,
    eventId: id,
    roomId: id,
    characterIds: z.array(id).min(1).max(GAME.maxCharacters),
    choiceId: id.nullable(),
    results: z.array(effectResultSchema).max(GAME.maxCharacters),
    tokenDelta: z.number().int(),
  }),
  z.strictObject({
    id,
    type: z.literal('identity'),
    day: count,
    roomId: id,
    actionId: id,
    identity: z.string().min(1).max(40),
    results: z.array(effectResultSchema).max(GAME.maxCharacters),
    habitabilityDelta: z.number().int().min(-100).max(100),
    cost: z.strictObject({ energy: count, stamina: count, tokens: count }),
  }),
  z.strictObject({
    id,
    type: z.literal('condition'),
    day: count,
    characterId: id,
    reason: z.enum(['stamina', 'mood', 'energy']),
    delta: signedStatsSchema,
    leaveUntilDay: count,
  }),
]);
export type GameLog = z.infer<typeof logSchema>;
export const playerSchema = z.strictObject({
  identity: z.enum([
    'leader',
    'observer',
    'member',
    'parent',
    'warden',
    'manager',
    'counselor',
    'neighbor',
    'custom',
  ]),
  age: z.number().int().min(18).max(120),
  customTitle: optionalText,
});
const gameBaseSchema = z.strictObject({
  version: z.literal(GAME.version),
  slotId: id,
  name: text,
  setup: z.enum(['identity', 'room', 'characters', 'done']),
  day: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  lastSettledDay: count,
  identityActions: z.strictObject({
    day: count,
    roomIds: z.array(id).max(GAME.maxRooms),
    operationIds: z.array(id).max(GAME.maxRooms),
  }),
  wallet: z.strictObject({
    tokens: z.number().int().min(0).max(ACTIVITY.maxTokens),
  }),
  eventProgress: z
    .array(
      z.strictObject({
        roomId: id,
        checkedThrough: count,
        seenEventIds: z.array(id).max(CAMPUS_EVENTS.length),
      }),
    )
    .max(GAME.maxRooms),
  player: playerSchema,
  rooms: z.array(roomSchema).min(1).max(GAME.maxRooms),
  characters: z.array(characterSchema).max(GAME.maxCharacters),
  clock: z.strictObject({
    anchor: count,
    lastObserved: count,
    mode: z.enum(['normal', 'fast']),
  }),
  randomSeed: z.number().int().min(1).max(0xffffffff),
  pendingEvents: z
    .array(
      z.strictObject({
        id,
        eventId: id,
        roomId: id,
        day: count,
        characterIds: z.array(id).max(GAME.maxCharacters),
      }),
    )
    .max(GAME.maxPendingEvents),
  resolvedEventIds: z.array(id).max(10000),
  wardrobe: z.strictObject({
    unlockedIds: z.array(id).max(1000),
    presets: z.array(presetSchema).max(WARDROBE.maxPresets),
  }),
  settings: z.strictObject({ roleplay: z.boolean(), sound: z.boolean() }),
  legacy: oldLegacySchema.extend({
    portraits: z.array(portraitSchema).max(GAME.maxPortraits),
  }),
  logs: z.array(logSchema).max(GAME.maxLogs),
});
type ReferenceState = Omit<
  z.infer<typeof gameBaseSchema>,
  | 'version'
  | 'player'
  | 'characters'
  | 'setup'
  | 'wardrobe'
  | 'wallet'
  | 'eventProgress'
  | 'logs'
  | 'legacy'
  | 'identityActions'
  | 'rooms'
> & {
  rooms: Array<Omit<Room, 'habitability'>>;
  logs: Array<{ id: string }>;
  characters: Array<
    Pick<Character, 'id' | 'roomId' | 'bedId' | 'settledDays'> & {
      daily: { day: number };
    }
  >;
};
function validateReferences(game: ReferenceState, context: z.RefinementCtx) {
  const fail = (message: string) =>
    context.addIssue({ code: 'custom', message });
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) fail(`${label}重复`);
  };
  unique(
    game.rooms.map((room) => room.id),
    '寝室 ID',
  );
  unique(
    game.rooms.flatMap((room) => room.beds.map((bed) => bed.id)),
    '床位 ID',
  );
  unique(
    game.characters.map((character) => character.id),
    '角色 ID',
  );
  unique(
    game.characters.map((character) => character.bedId),
    '床位占用',
  );
  unique(
    game.logs.map((log) => log.id),
    '日志 ID',
  );
  unique(
    game.pendingEvents.map((event) => event.id),
    '事件 ID',
  );
  if (game.lastSettledDay !== game.day - 1) fail('日结算标记不一致');
  if (game.clock.lastObserved < game.clock.anchor) fail('时间锚点不一致');
  for (const room of game.rooms) {
    if (room.beds.length !== room.capacity) fail('床位数量与容量不一致');
    if (room.facilities.dryWet && room.facilities.bathroom !== 'private')
      fail('干湿分离需要独卫');
    room.beds.forEach((bed, index) => {
      const unit =
        room.bedType === 'loft' ? index + 1 : Math.floor(index / 2) + 1;
      const level =
        room.bedType === 'loft' ? 'loft' : index % 2 === 0 ? 'upper' : 'lower';
      if (bed.unit !== unit || bed.level !== level)
        fail('床型或上下铺配置不一致');
    });
  }
  for (const character of game.characters) {
    const room = game.rooms.find(
      (candidate) => candidate.id === character.roomId,
    );
    if (!room?.beds.some((bed) => bed.id === character.bedId))
      fail('角色床位引用无效');
    if (
      character.daily.day !== game.day ||
      character.settledDays > game.lastSettledDay
    )
      fail('角色成长日期不一致');
  }
  for (const event of game.pendingEvents) {
    if (
      !game.rooms.some((room) => room.id === event.roomId) ||
      event.characterIds.some(
        (cid) => !game.characters.some((character) => character.id === cid),
      )
    )
      fail('事件引用无效');
  }
}
function validateProfileNames(
  game: {
    player: z.infer<typeof playerSchema>;
    characters: Array<Pick<Character, 'major' | 'customMajor'>>;
  },
  context: z.RefinementCtx,
) {
  if (game.player.identity === 'custom' && !game.player.customTitle)
    context.addIssue({ code: 'custom', message: '请填写自定义身份名称' });
  if (
    game.characters.some(
      (character) => character.major === 'custom' && !character.customMajor,
    )
  )
    context.addIssue({ code: 'custom', message: '请填写自定义专业名称' });
}
function validateWardrobeReferences(
  game: {
    wardrobe: {
      unlockedIds: string[];
      presets: Array<{ id: string; outfit: z.infer<typeof outfitSchema> }>;
    };
    characters: Array<
      Pick<Character, 'outfit'> & { stats?: { progress: number } }
    >;
  },
  context: z.RefinementCtx,
  slots: readonly string[] = OPEN_SLOTS,
) {
  const fail = (message: string) =>
    context.addIssue({ code: 'custom', message });
  const ids = game.wardrobe.unlockedIds;
  if (
    new Set(ids).size !== ids.length ||
    ids.some((itemId) => !findClothing(itemId))
  )
    fail('服装解锁 ID 无效或重复');
  if (
    new Set(game.wardrobe.presets.map((preset) => preset.id)).size !==
    game.wardrobe.presets.length
  )
    fail('套装 ID 重复');
  const checkOutfit = (outfit: z.infer<typeof outfitSchema>) => {
    for (const slot of slots as readonly (typeof OPEN_SLOTS)[number][])
      if (
        (outfit[slot] !== null ||
          CORE_SLOTS.includes(slot as (typeof CORE_SLOTS)[number])) &&
        (findClothing(outfit[slot])?.slot !== slot ||
          !ids.includes(outfit[slot]!))
      )
        fail('服装不存在、槽位不符或尚未解锁');
    for (const [slot, itemId] of Object.entries(outfit))
      if (!slots.includes(slot) && itemId !== null)
        fail('未开放的服装槽位不可应用');
  };
  game.characters.forEach((character) => {
    checkOutfit(character.outfit);
    if (slots.includes('skirt') && character.stats)
      for (const slot of OPEN_SLOTS) {
        const minimum = findClothing(character.outfit[slot])?.minProgress ?? 0;
        if (character.stats.progress < minimum)
          fail('男娘进度不足，不能穿戴该妆造');
      }
  });
  game.wardrobe.presets.forEach((preset) => checkOutfit(preset.outfit));
}
const preCampusAppearance = appearanceSchema.omit({ face: true });
const preRiskCharacter = characterSchema.omit({
  condition: true,
  tagProgressGranted: true,
});
const preCampusCharacter = preRiskCharacter.extend({
  appearance: preCampusAppearance,
  daily: characterSchema.shape.daily.omit({ identityParticipated: true }),
});
const oldEventsLog = logSchema.options[6].omit({ habitabilityDelta: true });
const preCampusLogs = z
  .array(
    z.discriminatedUnion('type', [
      logSchema.options[0],
      logSchema.options[1],
      logSchema.options[2],
      logSchema.options[3],
      logSchema.options[4],
      logSchema.options[5],
      oldEventsLog,
    ]),
  )
  .max(GAME.maxLogs);
const campusBaseSchema = gameBaseSchema.omit({ identityActions: true }).extend({
  version: z.literal('1.4'),
  characters: z.array(preCampusCharacter).max(GAME.maxCharacters),
  rooms: z
    .array(roomSchema.omit({ habitability: true }))
    .min(1)
    .max(GAME.maxRooms),
  legacy: oldLegacySchema.extend({
    portraits: z
      .array(portraitSchema.extend({ appearance: preCampusAppearance }))
      .max(GAME.maxPortraits),
  }),
  logs: preCampusLogs,
});
const activityBaseSchema = campusBaseSchema.extend({
  version: z.literal('1.3'),
  legacy: oldLegacySchema,
});
export const gameSchema = gameBaseSchema
  .superRefine(validateReferences)
  .superRefine(validateProfileNames)
  .superRefine(validateActivityState)
  .superRefine((game, context) => {
    if (
      game.characters.some(
        (character) =>
          character.condition.leaveUntilDay >
          Math.min(Number.MAX_SAFE_INTEGER, game.day + GAME.leaveDays),
      )
    )
      context.addIssue({
        code: 'custom',
        message: '请假期限不能超过未来 7 个游戏日',
      });
    if (
      game.identityActions.day !== game.day ||
      new Set(game.identityActions.roomIds).size !==
        game.identityActions.roomIds.length ||
      new Set(game.identityActions.operationIds).size !==
        game.identityActions.operationIds.length ||
      game.identityActions.roomIds.length !==
        game.identityActions.operationIds.length ||
      game.identityActions.roomIds.some(
        (id) => !game.rooms.some((room) => room.id === id),
      )
    )
      context.addIssue({ code: 'custom', message: '身份行动账本无效' });
    for (const log of game.logs)
      if (
        log.type === 'identity' &&
        (!findIdentityAction(log.actionId)?.identities.includes(
          log.identity as GameState['player']['identity'],
        ) ||
          log.results.length === 0 ||
          new Set(log.results.map((row) => row.characterId)).size !==
            log.results.length)
      )
        context.addIssue({ code: 'custom', message: '身份行动日志无效' });
    const ids = game.legacy.portraits.map((portrait) => portrait.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(game.legacy.achievements).size !==
        game.legacy.achievements.length ||
      new Set(game.legacy.encyclopedia).size !== game.legacy.encyclopedia.length
    )
      context.addIssue({ code: 'custom', message: '累计图鉴或成就 ID 重复' });
    for (const portrait of game.legacy.portraits) {
      for (const slot of OPEN_SLOTS)
        if (
          (portrait.outfit[slot] !== null ||
            CORE_SLOTS.includes(slot as (typeof CORE_SLOTS)[number])) &&
          findClothing(portrait.outfit[slot])?.slot !== slot
        )
          context.addIssue({ code: 'custom', message: '角色图鉴服装引用无效' });
      for (const [slot, itemId] of Object.entries(portrait.outfit))
        if (
          !OPEN_SLOTS.includes(slot as (typeof OPEN_SLOTS)[number]) &&
          itemId !== null
        )
          context.addIssue({ code: 'custom', message: '图鉴包含未开放槽位' });
    }
  })
  .superRefine(validateWardrobeReferences);
export const styleSaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: gameBaseSchema
    .extend({
      version: z.literal('1.5'),
      characters: z.array(preRiskCharacter).max(GAME.maxCharacters),
      logs: z
        .array(
          z.discriminatedUnion('type', [
            logSchema.options[0],
            logSchema.options[1],
            logSchema.options[2],
            logSchema.options[3],
            logSchema.options[4],
            logSchema.options[5],
            logSchema.options[6],
            logSchema.options[7],
          ]),
        )
        .max(GAME.maxLogs),
    })
    .superRefine((old, context) => {
      const result = gameSchema.safeParse({
        ...old,
        version: GAME.version,
        characters: old.characters.map((character) => ({
          ...character,
          tagProgressGranted: false,
          condition: {
            leaveUntilDay: 0,
            staminaZero: false,
            moodZero: false,
            energyZero: false,
          },
        })),
      });
      if (!result.success)
        for (const issue of result.error.issues)
          context.addIssue({
            code: 'custom',
            path: issue.path,
            message: issue.message,
          });
    }),
});
function validateActivityState(
  game:
    | z.infer<typeof gameBaseSchema>
    | z.infer<typeof activityBaseSchema>
    | z.infer<typeof campusBaseSchema>,
  context: z.RefinementCtx,
) {
  const fail = (message: string) =>
    context.addIssue({ code: 'custom', message });
  if (game.setup === 'done' && !game.characters.length)
    fail('已入住存档至少需要一位室友');
  for (const character of game.characters) {
    if (character.growth.some((entry) => entry.day < 1 || entry.day > game.day))
      fail('成长记录日期无效');
  }
  if (
    new Set(game.pendingEvents.map((event) => `${event.roomId}:${event.day}`))
      .size !== game.pendingEvents.length
  )
    fail('同一寝室同一天有多个待选事件');
  for (const log of game.logs) {
    if (log.day < 1 || log.day > game.day) fail('日志日期无效');
    if (
      log.type === 'interaction' &&
      (log.actionId === null) === (log.giftId === null)
    )
      fail('互动日志需要且只能有一个行为或礼物');
    if (
      log.type === 'day' &&
      (log.day > game.lastSettledDay ||
        new Set(log.results.map((result) => result.characterId)).size !==
          log.results.length)
    )
      fail('日结算日志的日期或参与者无效');
    if (log.type === 'event') {
      const event = findEvent(log.eventId);
      if (
        !event ||
        !event.outcomes.some((outcome) => outcome.id === log.choiceId) ||
        log.triggerDay > log.day ||
        log.triggerDay < event.condition.minDay ||
        !game.resolvedEventIds.includes(log.instanceId) ||
        new Set(log.characterIds).size !== log.characterIds.length ||
        new Set(log.results.map((result) => result.characterId)).size !==
          log.results.length ||
        log.results.length !== log.characterIds.length ||
        log.results.some(
          (result) => !log.characterIds.includes(result.characterId),
        )
      )
        fail('事件日志的模板、参与者或结算回执无效');
    }
  }
  const receipts = game.characters.flatMap(
    (character) => character.daily.operationIds,
  );
  if (
    new Set(receipts).size !== receipts.length ||
    game.characters.some(
      (character) =>
        character.daily.operationIds.length !==
        character.daily.interactions + character.daily.gifts,
    )
  )
    fail('互动回执与每日次数不一致');
  if (new Set(game.resolvedEventIds).size !== game.resolvedEventIds.length)
    fail('已完成事件 ID 重复');
  if (
    new Set(game.eventProgress.map((progress) => progress.roomId)).size !==
    game.eventProgress.length
  )
    fail('寝室事件账本重复');
  for (const progress of game.eventProgress) {
    if (
      !game.rooms.some((room) => room.id === progress.roomId) ||
      progress.checkedThrough > game.lastSettledDay ||
      new Set(progress.seenEventIds).size !== progress.seenEventIds.length ||
      progress.seenEventIds.some((eventId) => !findEvent(eventId))
    )
      fail('寝室事件账本无效');
  }
  if (
    new Set(
      game.pendingEvents.map((event) =>
        JSON.stringify([event.roomId, event.eventId]),
      ),
    ).size !== game.pendingEvents.length
  )
    fail('同一寝室的待选事件重复');
  for (const pending of game.pendingEvents) {
    const event = findEvent(pending.eventId);
    const ledger = game.eventProgress.find(
      (progress) => progress.roomId === pending.roomId,
    );
    if (
      !event?.branch ||
      !pending.characterIds.length ||
      new Set(pending.characterIds).size !== pending.characterIds.length ||
      pending.day < event.condition.minDay ||
      pending.day > game.lastSettledDay ||
      !ledger?.seenEventIds.includes(pending.eventId) ||
      ledger.checkedThrough < pending.day ||
      game.resolvedEventIds.includes(pending.id)
    )
      fail('待选事件的模板、回执或触发日无效');
  }
}
export const activitySaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: activityBaseSchema
    .superRefine(validateReferences)
    .superRefine(validateProfileNames)
    .superRefine(validateActivityState)
    .superRefine((game, context) =>
      validateWardrobeReferences(game, context, CORE_SLOTS),
    ),
});
export const campusSaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: campusBaseSchema
    .superRefine(validateReferences)
    .superRefine(validateProfileNames)
    .superRefine(validateActivityState)
    .superRefine((game, context) =>
      validateWardrobeReferences(game, context, CORE_SLOTS),
    ),
});
export type GameState = z.infer<typeof gameSchema>;
export const saveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: gameSchema,
});
export type Save = z.infer<typeof saveSchema>;

// Validate the actual 1.0 shape before adding any new fields.
const oldAppearanceSchema = preCampusAppearance.omit({ bottomColor: true });
const oldCharacterM3Schema = preCampusCharacter.extend({
  daily: oldDailySchema,
});
const oldCharacterSchema = oldCharacterM3Schema.extend({
  appearance: oldAppearanceSchema,
});
const oldWardrobeSchema = gameBaseSchema.shape.wardrobe.extend({
  presets: z
    .array(presetSchema.omit({ colors: true }))
    .max(WARDROBE.maxPresets),
});
const oldLogsSchema = z
  .array(
    z.discriminatedUnion('type', [
      logSchema.options[0],
      logSchema.options[1].omit({ allowance: true }).extend({
        results: z.array(oldDayResultSchema).max(GAME.maxCharacters),
      }),
      logSchema.options[2],
      logSchema.options[3],
    ]),
  )
  .max(GAME.maxLogs);
const m3BaseSchema = campusBaseSchema
  .omit({ wallet: true, eventProgress: true })
  .extend({
    version: z.literal('1.2'),
    legacy: oldLegacySchema,
    characters: z.array(oldCharacterM3Schema).max(GAME.maxCharacters),
    logs: z
      .array(
        z.discriminatedUnion('type', [
          oldLogsSchema.element.options[0],
          oldLogsSchema.element.options[1],
          oldLogsSchema.element.options[2],
          oldLogsSchema.element.options[3],
          logSchema.options[4],
        ]),
      )
      .max(GAME.maxLogs),
  });
export const wardrobeSaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: m3BaseSchema
    .superRefine(validateReferences)
    .superRefine(validateProfileNames)
    .superRefine((game, context) =>
      validateWardrobeReferences(game, context, CORE_SLOTS),
    ),
});
const m2BaseSchema = m3BaseSchema.extend({
  version: z.literal('1.1'),
  characters: z.array(oldCharacterSchema).max(GAME.maxCharacters),
  wardrobe: oldWardrobeSchema,
  logs: oldLogsSchema,
});
export const previousSaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: m2BaseSchema
    .superRefine(validateReferences)
    .superRefine(validateProfileNames),
});
export const legacySaveSchema = z.strictObject({
  revision: count,
  commitId: id,
  game: m2BaseSchema
    .omit({ setup: true })
    .extend({
      version: z.literal('1.0'),
      player: playerSchema.omit({ customTitle: true }),
      characters: z
        .array(oldCharacterSchema.omit({ customMajor: true }))
        .max(GAME.maxCharacters),
      logs: z
        .array(
          z.union([
            oldLogsSchema.element.options[1],
            logSchema.options[2],
            logSchema.options[3],
          ]),
        )
        .max(GAME.maxLogs),
    })
    .superRefine(validateReferences),
});
