import {
  legacySaveSchema,
  previousSaveSchema,
  wardrobeSaveSchema,
  activitySaveSchema,
  campusSaveSchema,
  styleSaveSchema,
  saveSchema,
  type Save,
} from './model';
import { DEFAULT_BOTTOM_COLOR, DEFAULT_OUTFIT_COLORS } from '../data/clothes';
import { syncWardrobeUnlocks } from './unlocks';
import { ACTIVITY, GAME } from '../data/constants';
import { emptyDaily, zeroStats } from './activityState';

export const MIGRATIONS: Readonly<
  Record<string, { to: string; migrate: (value: unknown) => unknown }>
> = {
  '1.0': {
    to: '1.1',
    migrate(value) {
      const original = legacySaveSchema.parse(value);
      const game = {
        ...original.game,
        version: '1.1',
        setup: 'done',
        player: {
          ...original.game.player,
          customTitle:
            original.game.player.identity === 'custom' ? '自定义室友' : '',
        },
        characters: original.game.characters.map((character) => ({
          ...character,
          customMajor: character.major === 'custom' ? '自定义专业' : '',
        })),
      };
      return { ...original, game };
    },
  },
  '1.1': {
    to: '1.2',
    migrate(value) {
      const original = previousSaveSchema.parse(value);
      const game = {
        ...original.game,
        version: '1.2' as const,
        characters: original.game.characters.map((character) => ({
          ...character,
          appearance: {
            ...character.appearance,
            bottomColor: DEFAULT_BOTTOM_COLOR,
          },
        })),
        wardrobe: {
          ...original.game.wardrobe,
          presets: original.game.wardrobe.presets.map((preset) => ({
            ...preset,
            colors: { ...DEFAULT_OUTFIT_COLORS },
          })),
        },
      };
      return { ...original, game };
    },
  },
  '1.2': {
    to: '1.3',
    migrate(value) {
      const original = wardrobeSaveSchema.parse(value);
      const game = {
        ...original.game,
        version: '1.3' as const,
        wallet: { tokens: ACTIVITY.startingTokens },
        eventProgress: original.game.rooms.map((room) => ({
          roomId: room.id,
          checkedThrough: original.game.lastSettledDay,
          seenEventIds: [
            ...new Set(
              original.game.pendingEvents
                .filter((pending) => pending.roomId === room.id)
                .map((pending) => pending.eventId),
            ),
          ],
        })),
        characters: original.game.characters.map((character, index) => ({
          ...character,
          daily: {
            ...(() => {
              const { identityParticipated, ...daily } = emptyDaily(
                character.daily.day,
              );
              void identityParticipated;
              return daily;
            })(),
            ...character.daily,
            operationIds: Array.from(
              { length: character.daily.interactions + character.daily.gifts },
              (_, operation) =>
                `migrated-${index}-${character.daily.day}-${operation}`,
            ),
          },
        })),
        logs: original.game.logs.map((log) =>
          log.type === 'day'
            ? {
                ...log,
                allowance: 0,
                results: log.results.map((result) => ({
                  ...result,
                  dryWet: null,
                  activity: { interaction: zeroStats(), event: zeroStats() },
                })),
              }
            : log,
        ),
      };
      return activitySaveSchema.parse({
        ...original,
        game: syncWardrobeUnlocks(game),
      });
    },
  },
  '1.3': {
    to: '1.4',
    migrate(value) {
      const original = activitySaveSchema.parse(value);
      return campusSaveSchema.parse({
        ...original,
        game: {
          ...original.game,
          version: '1.4',
          legacy: { ...original.game.legacy, portraits: [] },
        },
      });
    },
  },
  '1.4': {
    to: '1.5',
    migrate(value) {
      const original = campusSaveSchema.parse(value);
      const upgraded = styleSaveSchema.parse({
        ...original,
        game: {
          ...original.game,
          version: '1.5',
          identityActions: {
            day: original.game.day,
            roomIds: [],
            operationIds: [],
          },
          rooms: original.game.rooms.map((room) => ({
            ...room,
            habitability: GAME.defaultHabitability,
          })),
          characters: original.game.characters.map((character) => ({
            ...character,
            daily: { ...character.daily, identityParticipated: false },
            appearance: { ...character.appearance, face: 'gentle' },
          })),
          legacy: {
            ...original.game.legacy,
            portraits: original.game.legacy.portraits.map((portrait) => ({
              ...portrait,
              appearance: { ...portrait.appearance, face: 'gentle' },
            })),
          },
        },
      });
      return { ...upgraded, game: syncWardrobeUnlocks(upgraded.game) };
    },
  },
  '1.5': {
    to: '1.6',
    migrate(value) {
      const original = styleSaveSchema.parse(value);
      const game = {
        ...original.game,
        version: '1.6' as const,
        characters: original.game.characters.map((character) => ({
          ...character,
          tagProgressGranted: character.tags.includes('男娘'),
          stats: {
            ...character.stats,
            progress: character.tags.includes('男娘')
              ? Math.max(character.stats.progress, GAME.tagInitialProgress)
              : character.stats.progress,
          },
          condition: {
            leaveUntilDay: 0,
            staminaZero: false,
            moodZero: false,
            energyZero: false,
          },
        })),
      };
      return saveSchema.parse({ ...original, game: syncWardrobeUnlocks(game) });
    },
  },
};

export function decodeSave(value: unknown): Save {
  let next = value;
  let version = (next as { game?: { version?: unknown } } | null)?.game
    ?.version;
  const visited = new Set<string>();
  while (version !== GAME.version) {
    if (typeof version !== 'string' || !/^\d+\.\d+$/u.test(version))
      throw new Error('存档版本格式无法识别，原始文件保持不变。');
    const migration = MIGRATIONS[version];
    if (!migration || visited.has(version))
      throw new Error(
        `暂不支持存档版本 ${version}，请使用支持该版本的应用，原始文件保持不变。`,
      );
    visited.add(version);
    next = migration.migrate(next);
    version = (next as { game?: { version?: unknown } } | null)?.game?.version;
    if (version !== migration.to)
      throw new Error('存档迁移步骤不完整，原始文件保持不变。');
  }
  return saveSchema.parse(next);
}
