import { z } from 'zod';
import { GAME, SAVES } from '../data/constants';
import {
  characterSchema,
  gameSchema,
  logSchema,
  saveSchema,
  activitySaveSchema,
  campusSaveSchema,
  type Stats,
  type Save,
} from './model';

const keys = [
  'affection',
  'mood',
  'stamina',
  'energy',
  'progress',
  'rapport',
] as const;
const integer = z.number().int();
const tuple = z.tuple([integer, integer, integer, integer, integer, integer]);
const partialTuple = z.tuple([
  integer.nullable(),
  integer.nullable(),
  integer.nullable(),
  integer.nullable(),
  integer.nullable(),
  integer.nullable(),
]);
const pack = (stats: Stats) => keys.map((key) => stats[key]);
const unpack = (values: z.infer<typeof tuple>): Stats => ({
  affection: values[0],
  mood: values[1],
  stamina: values[2],
  energy: values[3],
  progress: values[4],
  rapport: values[5],
});
const partialUnpack = (
  values: z.infer<typeof partialTuple>,
): Partial<Stats> => {
  const result: Partial<Stats> = {};
  keys.forEach((key, index) => {
    const value = values[index]!;
    if (value !== null) result[key] = value;
  });
  return result;
};
const packedGrowth = characterSchema.shape.growth.element.extend({
  delta: partialTuple,
});
const packedDayResult = logSchema.options[1].shape.results.element.extend({
  delta: tuple,
  activity: z.strictObject({ interaction: tuple, event: tuple }),
});
const packedEventResult = logSchema.options[6].shape.results.element.extend({
  delta: tuple,
});
const packedLog = z.discriminatedUnion('type', [
  logSchema.options[0],
  logSchema.options[1].extend({
    results: z.array(packedDayResult).max(GAME.maxCharacters),
  }),
  logSchema.options[2],
  logSchema.options[3],
  logSchema.options[4],
  logSchema.options[5].extend({ delta: tuple }),
  logSchema.options[6].extend({
    results: z.array(packedEventResult).max(GAME.maxCharacters),
  }),
  logSchema.options[7].extend({
    results: z.array(packedEventResult).max(GAME.maxCharacters),
  }),
  logSchema.options[8].extend({ delta: tuple }),
]);
const packedGame = z.strictObject({
  ...gameSchema.shape,
  version: z.enum(['1.3', '1.4', '1.5', '1.6']),
  identityActions: gameSchema.shape.identityActions.optional(),
  rooms: z
    .array(
      z.union([
        gameSchema.shape.rooms.element,
        campusSaveSchema.shape.game.shape.rooms.element,
      ]),
    )
    .min(1)
    .max(GAME.maxRooms),
  legacy: z.union([
    gameSchema.shape.legacy,
    activitySaveSchema.shape.game.shape.legacy,
    campusSaveSchema.shape.game.shape.legacy,
  ]),
  characters: z
    .array(
      characterSchema.extend({
        tagProgressGranted: characterSchema.shape.tagProgressGranted.optional(),
        condition: characterSchema.shape.condition.optional(),
        appearance: z.union([
          characterSchema.shape.appearance,
          characterSchema.shape.appearance.omit({ face: true }),
        ]),
        daily: z.union([
          characterSchema.shape.daily,
          characterSchema.shape.daily.omit({ identityParticipated: true }),
        ]),
        growth: z.array(packedGrowth).max(GAME.maxLogs),
      }),
    )
    .max(GAME.maxCharacters),
  logs: z.array(packedLog).max(GAME.maxLogs),
});
const compactSchema = z.strictObject({
  format: z.literal('roomdev-stats-tuples'),
  version: z.literal('1.0'),
  sourceRaw: z.string().max(SAVES.maxImportBytes).optional(),
  save: z.strictObject({
    revision: saveSchema.shape.revision,
    commitId: saveSchema.shape.commitId,
    game: packedGame,
  }),
});

// Only repeated numeric field names are removed; no entry or value is discarded.
export function encodeCompact(save: Save, sourceRaw?: string | null): string {
  const game = save.game;
  return JSON.stringify(
    compactSchema.parse({
      format: 'roomdev-stats-tuples',
      version: '1.0',
      ...(sourceRaw ? { sourceRaw } : {}),
      save: {
        ...save,
        game: {
          ...game,
          characters: game.characters.map((character) => ({
            ...character,
            growth: character.growth.map((entry) => ({
              ...entry,
              delta: keys.map((key) => entry.delta[key] ?? null),
            })),
          })),
          logs: game.logs.map((log) => {
            if (log.type === 'day')
              return {
                ...log,
                results: log.results.map((result) => ({
                  ...result,
                  delta: pack(result.delta),
                  activity: {
                    interaction: pack(result.activity.interaction),
                    event: pack(result.activity.event),
                  },
                })),
              };
            if (log.type === 'interaction' || log.type === 'condition')
              return { ...log, delta: pack(log.delta) };
            if (log.type === 'event' || log.type === 'identity')
              return {
                ...log,
                results: log.results.map((result) => ({
                  ...result,
                  delta: pack(result.delta),
                })),
              };
            return log;
          }),
        },
      },
    }),
  );
}
export function decodeCompact(value: unknown): unknown {
  if ((value as { format?: unknown } | null)?.format !== 'roomdev-stats-tuples')
    return value;
  const parsed = compactSchema.parse(value);
  const encoded = parsed.save;
  return {
    ...encoded,
    ...(parsed.sourceRaw ? { sourceRaw: parsed.sourceRaw } : {}),
    game: {
      ...encoded.game,
      characters: encoded.game.characters.map((character) => ({
        ...character,
        growth: character.growth.map((entry) => ({
          ...entry,
          delta: partialUnpack(entry.delta),
        })),
      })),
      logs: encoded.game.logs.map((log) => {
        if (log.type === 'day')
          return {
            ...log,
            results: log.results.map((result) => ({
              ...result,
              delta: unpack(result.delta),
              activity: {
                interaction: unpack(result.activity.interaction),
                event: unpack(result.activity.event),
              },
            })),
          };
        if (log.type === 'interaction' || log.type === 'condition')
          return { ...log, delta: unpack(log.delta) };
        if (log.type === 'event' || log.type === 'identity')
          return {
            ...log,
            results: log.results.map((result) => ({
              ...result,
              delta: unpack(result.delta),
            })),
          };
        return log;
      }),
    },
  };
}
