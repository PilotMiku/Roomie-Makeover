import { create } from 'zustand';
import { SAVES } from '../data/constants';
import { createNewGame } from '../domain/initial';
import { customizeGame, type CustomizeCommand } from '../domain/customize';
import { type BedType, type GameState } from '../domain/model';
import { changeBedType, moveCharacter } from '../domain/rules';
import { advanceTime, nextDay, type TimeResult } from '../domain/time';
import { changeWardrobe, type WardrobeCommand } from '../domain/wardrobe';
import { syncProgress } from '../domain/progress';
import { interact, type InteractionCommand } from '../domain/interactions';
import { chooseEvent, type EventChoiceCommand } from '../domain/events';
import { startNewRun } from '../domain/newRun';
import {
  performIdentityAction,
  type IdentityCommand,
} from '../domain/identityActions';

export { loadGame, writeGame, type GameStorage } from './persistence';
export function isFastMode() {
  return new URLSearchParams(window.location.search).get('fast') === '1';
}
import {
  loadGame,
  writeGame,
  readSlots,
  readSelection,
  browserStorage,
  browserSelection,
  type LoadedSave,
  type SlotSummary,
  type GameStorage,
} from './persistence';
import {
  exportArchive,
  importError,
  previewImport,
  slotIdSchema,
  slotKey,
  type SlotId,
} from '../domain/saves';
import {
  slotCommandSchema,
  type SlotCommand,
  type SaveActionResult,
} from './slotCommands';

interface GameStore extends LoadedSave {
  slots: SlotSummary[];
  generation: number;
  refreshSlots: () => void;
  retrySave: () => Promise<SaveActionResult>;
  manageSlot: (command: SlotCommand) => Promise<SaveActionResult>;
  exportSlot: (slotId: SlotId, original?: boolean) => Promise<SaveActionResult>;

  notice: string;
  identityAction: (command: IdentityCommand) => Promise<{ error?: string }>;
  achievementsEarned: string[];
  dismissAchievements: () => void;
  newRun: (input: {
    confirmed: true;
    expectedDay: number;
    expectedRuns: number;
    expectedRevision: number;
  }) => Promise<SaveActionResult>;
  initialize: () => void;
  tick: () => void;
  next: (expectedDay: number) => void;
  move: (characterId: string, bedId: string) => void;
  layout: (roomId: string, bedType: BedType) => void;
  detectConflict: () => void;
  customize: (
    command: CustomizeCommand,
  ) => Promise<{ error?: string; entityId?: string }>;
  dress: (command: WardrobeCommand) => Promise<{ error?: string }>;
  interact: (command: InteractionCommand) => Promise<{ error?: string }>;
  chooseEvent: (command: EventChoiceCommand) => Promise<{ error?: string }>;
}

export function createGameStore(
  storage: GameStorage,
  now: () => number,
  fast: () => boolean,
  visible: () => boolean,
  locks?: Pick<LockManager, 'request'>,
  selection?: GameStorage,
) {
  return create<GameStore>((set, get) => {
    const serialize = (task: () => void) => {
      const generation = get().generation;
      const guarded = () => {
        if (get().generation === generation) task();
      };
      if (!locks) {
        guarded();
        return;
      }
      void locks
        .request(SAVES.lockKey, guarded)
        .catch(() => set({ status: 'unavailable' }));
    };
    const commit = (game: GameState, notice: string) => {
      const current = get();
      if (current.status === 'invalid' || current.status === 'conflict') return;
      game = syncProgress(game);
      if (
        game === current.game &&
        current.raw !== null &&
        !current.dirty &&
        current.sourceRaw !== current.raw
      ) {
        if (notice) set({ notice });
        return;
      }
      const saved = writeGame(storage, current, game);
      const earned = saved.game.legacy.achievements.filter(
        (id) => !current.game.legacy.achievements.includes(id),
      );
      set({
        ...saved,
        slots: readSlots(storage, now(), fast()),
        notice: notice || current.notice,
        ...(earned.length ? { achievementsEarned: earned } : {}),
      });
    };
    const applyTime = (result: TimeResult) =>
      commit(result.game, result.notice);
    const applyActivity = async (
      command: InteractionCommand | EventChoiceCommand | IdentityCommand,
      kind: 'interaction' | 'event' | 'identity',
    ) => {
      const generation = get().generation;
      const task = () => {
        if (get().generation !== generation)
          return { error: '当前存档已切换，请重新操作。' };
        const current = get();
        if (current.status === 'invalid' || current.status === 'conflict')
          return { error: '存档已锁定，请先处理存档提示。' };
        const result =
          kind === 'identity'
            ? performIdentityAction(current.game, command)
            : kind === 'interaction'
              ? interact(current.game, command)
              : chooseEvent(current.game, command);
        if (result.error) return { error: result.error };
        commit(
          result.game,
          kind === 'interaction'
            ? '日常互动已结算。'
            : kind === 'identity'
              ? '身份行动已完成，结果已写入手记。'
              : '事件选择已结算，结果已写入手记。',
        );
        return get().status === 'conflict'
          ? { error: '其他标签页已修改存档，请刷新后继续。' }
          : {};
      };
      try {
        return locks ? await locks.request(SAVES.lockKey, task) : task();
      } catch {
        set({ status: 'unavailable' });
        return { error: '暂时无法完成操作，请检查存储权限。' };
      }
    };
    const checkTime = () => {
      const current = get();
      if (current.empty && !current.dirty) return;
      const game = current.game;
      if (game.setup !== 'done') {
        const timestamp = now();
        commit(
          {
            ...game,
            clock: {
              anchor: timestamp,
              lastObserved: timestamp,
              mode: fast() ? 'fast' : 'normal',
            },
          },
          '',
        );
      } else applyTime(advanceTime(game, now(), fast(), visible()));
    };
    const refreshSlots = () =>
      set({ slots: readSlots(storage, now(), fast()) });
    const flush = (): string | undefined => {
      const current = get();
      if (!current.dirty && current.sourceRaw !== current.raw) return;
      if (current.empty) return;
      const saved = writeGame(storage, current, current.game);
      set(saved);
      refreshSlots();
      if (saved.status !== 'ready')
        return '当前进度尚未可靠保存，无法切换。请先重试保存或导出当前进度。';
    };
    const activate = (loaded: LoadedSave, notice: string) => {
      let selectionNotice = '';
      try {
        selection?.setItem(SAVES.selectionKey, loaded.activeSlot);
      } catch {
        selectionNotice =
          ' 浏览器无法记住本页的槽位选择，刷新后请重新选择；游戏内容已保存。';
      }
      set({
        ...loaded,
        generation: get().generation + 1,
        achievementsEarned: [],
        notice: notice + selectionNotice,
      });
      refreshSlots();
    };
    const manageSlot = async (
      input: SlotCommand,
    ): Promise<SaveActionResult> => {
      const parsed = slotCommandSchema.safeParse(input);
      if (!parsed.success)
        return { error: '存档操作参数无效，覆盖或删除必须先确认。' };
      const command = parsed.data;
      const generation = get().generation;
      const task = (): SaveActionResult => {
        if (get().generation !== generation)
          return { error: '当前存档已变化，请重新操作。' };
        if (command.type === 'switch') {
          if (command.slotId === get().activeSlot) return {};
          const error = flush();
          if (error) return { error };
          const loaded = loadGame(storage, now(), fast(), command.slotId);
          if (loaded.empty && loaded.status === 'ready')
            return { error: '这个槽位还是空的，请先创建新故事。' };
          if (loaded.status !== 'ready') {
            activate(loaded, '原始存档已保留，可在回忆存档中下载备份并恢复。');
            return {};
          }
          const timed =
            loaded.game.setup === 'done'
              ? advanceTime(loaded.game, now(), fast(), visible())
              : {
                  game: {
                    ...loaded.game,
                    clock: {
                      anchor: now(),
                      lastObserved: now(),
                      mode: fast() ? ('fast' as const) : ('normal' as const),
                    },
                  },
                  notice: '',
                };
          const saved = writeGame(storage, loaded, timed.game);
          if (saved.status !== 'ready')
            return {
              error:
                '切换前无法可靠保存目标存档，仍保留当前槽。请检查存储空间或权限后重试。',
            };
          activate(saved, `已进入「${saved.game.name}」。${timed.notice}`);
          return {};
        }
        // Validate the entire incoming file again inside the lock, never trust a UI preview.
        const incoming =
          command.type === 'import' ? previewImport(command.raw) : undefined;
        const loaded = loadGame(storage, now(), fast(), command.slotId);
        if (loaded.status === 'unavailable')
          return { error: '无法读取目标槽，请检查站点存储权限后重试。' };
        if (loaded.raw !== command.expectedRaw) {
          refreshSlots();
          if (command.slotId === get().activeSlot) get().detectConflict();
          return { error: '目标槽在预览后已变化，请刷新列表并重新确认。' };
        }
        if (command.type === 'create') {
          if (!loaded.empty)
            return { error: '该槽已有存档，不能用新故事覆盖。' };
          const error = flush();
          if (error) return { error };
          const fresh = {
            ...createNewGame(now(), fast()),
            slotId: command.slotId,
            name: command.name,
          };
          const saved = writeGame(
            storage,
            { ...loaded, status: 'ready' },
            fresh,
          );
          if (saved.status !== 'ready')
            return {
              error:
                '新故事未保存成功，原存档不变。请释放空间或检查权限后重试。',
            };
          activate(saved, '新的故事已保存，从选择身份开始吧。');
          return {};
        }
        if (command.type === 'rename') {
          if (loaded.empty || loaded.status !== 'ready')
            return { error: '只有有效存档可以改名，原始数据已保留。' };
          const base = command.slotId === get().activeSlot ? get() : loaded;
          if (base.status === 'conflict' || base.status === 'invalid')
            return { error: '本页存档已锁定，请刷新后重试。' };
          const saved = writeGame(storage, base, {
            ...base.game,
            name: command.name,
          });
          if (saved.status !== 'ready') {
            if (command.slotId === get().activeSlot) set(saved);
            refreshSlots();
            return { error: '改名未写入，请检查存储空间或权限。' };
          }
          if (command.slotId === get().activeSlot)
            set({ ...saved, notice: '存档名称已保存。' });
          refreshSlots();
          return {};
        }
        if (command.type === 'delete') {
          if (loaded.empty) return { error: '该槽已为空，请刷新列表。' };
          // A tiny tombstone makes deletion atomic and prevents an old tab resurrecting it.
          const raw = JSON.stringify({
            deleted: true,
            commitId: crypto.randomUUID(),
          });
          storage.setItem(slotKey(command.slotId), raw);
          if (command.slotId === get().activeSlot)
            activate(
              loadGame(storage, now(), fast(), command.slotId),
              '该槽已删除，可创建新的故事或选择其他存档。',
            );
          else refreshSlots();
          return {};
        }
        if (!incoming) return { error: '缺少有效的导入文件。' };
        const game = {
          ...incoming.game,
          slotId: command.slotId,
          clock: {
            anchor: now(),
            lastObserved: now(),
            mode: fast() ? ('fast' as const) : ('normal' as const),
          },
        };
        const replacement = {
          ...loaded,
          game,
          status: 'ready' as const,
          sourceRaw: incoming.sourceRaw,
        };
        const saved = writeGame(storage, replacement, game);
        if (saved.status !== 'ready')
          return {
            error: '导入写入失败，原槽仍保持不变。请释放空间或检查权限后重试。',
          };
        if (command.slotId === get().activeSlot)
          activate(saved, '备份已恢复，自动计时从现在重新开始。');
        else refreshSlots();
        return {};
      };
      try {
        return locks ? await locks.request(SAVES.lockKey, task) : task();
      } catch (error) {
        refreshSlots();
        return {
          error: `操作未完成：${importError(error)} 请检查空间或权限后重试。`,
        };
      }
    };
    return {
      ...loadGame(storage, now(), fast(), readSelection(selection)),
      slots: readSlots(storage, now(), fast()),
      generation: 0,
      refreshSlots,
      manageSlot,
      retrySave: async () => {
        const task = () => {
          const current = get();
          if (current.status === 'invalid' || current.status === 'conflict')
            return { error: '此存档已锁定，请先备份并恢复。' };
          const saved = writeGame(storage, current, current.game);
          set({
            ...saved,
            notice:
              saved.status === 'ready'
                ? '当前进度已重新保存。'
                : '保存仍未成功，请导出备份并检查存储空间或权限。',
          });
          refreshSlots();
          return saved.status === 'ready'
            ? {}
            : { error: '保存仍未成功，内存进度和原有存档都已保留。' };
        };
        try {
          return locks ? await locks.request(SAVES.lockKey, task) : task();
        } catch {
          return { error: '无法重试保存，请检查存储权限。' };
        }
      },
      exportSlot: async (slotId, original = false) => {
        if (!slotIdSchema.safeParse(slotId).success)
          return { error: '存档槽无效。' };
        try {
          const loaded =
            slotId === get().activeSlot
              ? get()
              : loadGame(storage, now(), fast(), slotId);
          if (original) {
            const raw = loaded.sourceRaw ?? loaded.raw;
            return raw
              ? { raw, filename: `Roomie-Makeover-${slotId}-original.json` }
              : { error: '这个槽位没有原始备份。' };
          }
          if (loaded.status === 'invalid')
            return { error: '存档无法识别，请下载未修改的原始备份。' };
          if (loaded.empty) return { error: '该槽为空，请先创建故事。' };
          return {
            raw: exportArchive(loaded.game),
            filename: `Roomie-Makeover-${slotId}-day-${loaded.game.day}.json`,
          };
        } catch (error) {
          return { error: importError(error) };
        }
      },
      notice: '',
      achievementsEarned: [],
      dismissAchievements: () => set({ achievementsEarned: [] }),
      newRun: async (input) => {
        const generation = get().generation;
        const task = () => {
          const current = get();
          if (
            current.generation !== generation ||
            input.confirmed !== true ||
            current.game.day !== input.expectedDay ||
            current.game.legacy.runs !== input.expectedRuns ||
            current.revision !== input.expectedRevision
          )
            return { error: '故事已变化，请重新查看并确认新周目。' };
          if (current.status !== 'ready' || current.dirty || current.empty)
            return { error: '请先可靠保存当前故事，再开启新周目。' };
          try {
            const next = startNewRun(current.game, now(), fast());
            const saved = writeGame(storage, current, next);
            if (saved.status !== 'ready') {
              if (saved.status === 'conflict') set({ status: 'conflict' });
              return {
                error:
                  '新周目未能保存，原故事保持不变。请检查存储空间或其他标签页。',
              };
            }
            activate(saved, '新的一页已经打开，成就和图鉴都收在回忆里。');
            set({
              achievementsEarned: next.legacy.achievements.filter(
                (id) => !current.game.legacy.achievements.includes(id),
              ),
            });
            return {};
          } catch (error) {
            return { error: importError(error) };
          }
        };
        try {
          return locks ? await locks.request(SAVES.lockKey, task) : task();
        } catch {
          return { error: '暂时无法开启新周目，原故事保持不变。' };
        }
      },
      initialize: () => serialize(checkTime),
      tick: () => serialize(checkTime),
      next: (expectedDay) =>
        serialize(() => {
          if (
            get().game.setup === 'done' &&
            get().game.player.identity !== 'observer'
          )
            applyTime(
              nextDay(get().game, expectedDay, now(), fast(), visible()),
            );
        }),
      move: (characterId, bedId) =>
        serialize(() =>
          commit(
            moveCharacter(get().game, characterId, bedId),
            '床位已调整；已占用床位会交换两位室友。',
          ),
        ),
      layout: (roomId, bedType) =>
        serialize(() =>
          commit(
            changeBedType(get().game, roomId, bedType),
            '床型已调整，实际可住床位数保持不变。',
          ),
        ),
      customize: async (command) => {
        const generation = get().generation;
        const task = () => {
          if (get().generation !== generation)
            return { error: '当前存档已切换，请重新操作。' };
          const current = get();
          if (current.status === 'invalid' || current.status === 'conflict')
            return { error: '存档已锁定，请先处理存档提示。' };
          const result = customizeGame(current.game, command, now());
          if (result.error) return { error: result.error };
          commit(result.game, '自定义已保存。');
          if (get().status === 'conflict')
            return { error: '其他标签页已修改存档，请刷新后继续。' };
          return { entityId: result.entityId };
        };
        try {
          return locks ? await locks.request(SAVES.lockKey, task) : task();
        } catch {
          set({ status: 'unavailable' });
          return { error: '暂时无法完成保存，请检查站点存储权限。' };
        }
      },
      dress: async (command) => {
        const generation = get().generation;
        const task = () => {
          if (get().generation !== generation)
            return { error: '当前存档已切换，请重新操作。' };
          const current = get();
          if (current.status === 'invalid' || current.status === 'conflict')
            return { error: '存档已锁定，请先处理存档提示。' };
          const result = changeWardrobe(current.game, command);
          if (result.error) return { error: result.error };
          commit(result.game, '穿搭已更新。');
          return get().status === 'conflict'
            ? { error: '其他标签页已修改存档，请刷新后继续。' }
            : {};
        };
        try {
          return locks ? await locks.request(SAVES.lockKey, task) : task();
        } catch {
          set({ status: 'unavailable' });
          return { error: '暂时无法保存穿搭，请检查存储权限。' };
        }
      },
      interact: (command) => applyActivity(command, 'interaction'),
      identityAction: (command) => applyActivity(command, 'identity'),
      chooseEvent: (command) => applyActivity(command, 'event'),
      detectConflict: () => {
        try {
          if (storage.getItem(slotKey(get().activeSlot)) !== get().raw)
            set({ status: 'conflict' });
        } catch {
          set({ status: 'unavailable' });
        }
        refreshSlots();
      },
    };
  });
}

export const useGame = createGameStore(
  browserStorage(),
  Date.now,
  isFastMode,
  () => document.visibilityState === 'visible',
  navigator.locks,
  browserSelection(),
);
