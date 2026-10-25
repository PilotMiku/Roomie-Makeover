import {
  wardrobeSaveSchema,
  campusSaveSchema,
  type GameState,
} from '../domain/model';
import { encodeCompact } from '../domain/compactSave';

export function oldM7Game(game: GameState) {
  const { identityActions, ...rest } = game;
  void identityActions;
  const appearance = ({
    face,
    ...colors
  }: GameState['characters'][number]['appearance']) => {
    void face;
    return colors;
  };
  return campusSaveSchema.parse({
    revision: 1,
    commitId: 'm7-fixture',
    game: {
      ...rest,
      version: '1.4',
      rooms: game.rooms.map(({ habitability, ...room }) => {
        void habitability;
        return room;
      }),
      characters: game.characters.map(
        ({ condition, tagProgressGranted, ...character }) => {
          void condition;
          void tagProgressGranted;
          const { identityParticipated, ...daily } = character.daily;
          void identityParticipated;
          return {
            ...character,
            daily,
            appearance: appearance(character.appearance),
          };
        },
      ),
      legacy: {
        ...game.legacy,
        portraits: game.legacy.portraits.map((portrait) => ({
          ...portrait,
          appearance: appearance(portrait.appearance),
        })),
      },
      logs: game.logs
        .filter((log) => log.type !== 'identity' && log.type !== 'condition')
        .map((log) => {
          if (log.type !== 'event') return log;
          const { habitabilityDelta, ...old } = log;
          void habitabilityDelta;
          return old;
        }),
    },
  }).game;
}

export function oldCompactArchive(
  game: GameState,
  version: '1.3' | '1.4' = '1.3',
) {
  const packed = JSON.parse(
    encodeCompact({ revision: 5, commitId: 'old-packed', game }),
  );
  const old = oldM7Game(game);
  delete packed.save.game.identityActions;
  packed.save.game.version = version;
  packed.save.game.rooms = old.rooms;
  packed.save.game.legacy = old.legacy;
  if (version === '1.3') delete packed.save.game.legacy.portraits;
  for (const character of packed.save.game.characters) {
    delete character.condition;
    delete character.tagProgressGranted;
    delete character.appearance.face;
    delete character.daily.identityParticipated;
  }
  packed.save.game.logs = packed.save.game.logs.filter(
    (log: { type: string }) =>
      log.type !== 'identity' && log.type !== 'condition',
  );
  for (const log of packed.save.game.logs)
    if (log.type === 'event') delete log.habitabilityDelta;
  return JSON.stringify(packed);
}

// Build the actual M3 format. Never pass current-only fields to an old schema.
export function oldM3Game(game: GameState) {
  const old = oldM7Game(game);
  const { wallet, eventProgress, ...rest } = old;
  void wallet;
  void eventProgress;
  return wardrobeSaveSchema.parse({
    revision: 1,
    commitId: 'm3-fixture',
    game: {
      ...rest,
      version: '1.2',
      legacy: {
        runs: game.legacy.runs,
        achievements: game.legacy.achievements,
        encyclopedia: game.legacy.encyclopedia,
      },
      characters: old.characters.map((character) => ({
        ...character,
        daily: {
          day: character.daily.day,
          progressGained: character.daily.progressGained,
          interactions: character.daily.interactions,
          gifts: character.daily.gifts,
        },
      })),
      logs: game.logs
        .filter(
          (log) =>
            log.type !== 'interaction' &&
            log.type !== 'event' &&
            log.type !== 'identity' &&
            log.type !== 'condition',
        )
        .map((log) => {
          if (log.type !== 'day') return log;
          const { allowance, ...dayLog } = log;
          void allowance;
          return {
            ...dayLog,
            results: log.results.map(({ dryWet, activity, ...result }) => {
              void dryWet;
              void activity;
              return result;
            }),
          };
        }),
    },
  }).game;
}
