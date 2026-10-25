import { SAVES } from '../data/constants';
import { createNewGame } from '../domain/initial';
import { saveSchema, type GameState } from '../domain/model';
import {
  decodeStored,
  encodeStored,
  deletedSlotSchema,
  importError,
  slotKey,
  parseArchiveJson,
  type SlotId,
} from '../domain/saves';
import { syncProgress } from '../domain/progress';

export type SaveStatus = 'ready' | 'invalid' | 'unavailable' | 'conflict';
export interface GameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface LoadedSave {
  game: GameState;
  activeSlot: SlotId;
  revision: number;
  raw: string | null;
  sourceRaw: string | null;
  status: SaveStatus;
  empty: boolean;
  dirty: boolean;
  error?: string;
}
export function loadGame(
  storage: GameStorage,
  now: number,
  fast: boolean,
  activeSlot: SlotId = SAVES.slots[0],
): LoadedSave {
  const fresh: LoadedSave = {
    game: { ...createNewGame(now, fast), slotId: activeSlot },
    activeSlot,
    revision: 0,
    raw: null,
    sourceRaw: null,
    status: 'ready',
    empty: true,
    dirty: false,
  };
  let raw: string | null = null;
  try {
    raw = storage.getItem(slotKey(activeSlot));
    if (raw === null) return fresh;
    const value = parseArchiveJson(raw);
    if (deletedSlotSchema.safeParse(value).success) return { ...fresh, raw };
    const decoded = decodeStored(value);
    if (decoded.save.game.slotId !== activeSlot)
      throw new Error('存档槽编号与所在位置不一致，原始数据已保留。');
    return {
      ...fresh,
      game: decoded.save.game,
      revision: decoded.save.revision,
      raw,
      sourceRaw: decoded.sourceRaw ?? (decoded.migrated ? raw : null),
      empty: false,
    };
  } catch (error) {
    return {
      ...fresh,
      raw,
      empty: raw === null,
      status: raw !== null ? 'invalid' : 'unavailable',
      error: importError(error),
    };
  }
}
export function writeGame(
  storage: GameStorage,
  loaded: LoadedSave,
  game: GameState,
): LoadedSave {
  if (loaded.status === 'invalid' || loaded.status === 'conflict')
    return loaded;
  game = syncProgress(game);
  let raw: string;
  try {
    if (game.slotId !== loaded.activeSlot) throw new Error('存档槽不一致。');
    const save = saveSchema.parse({
      revision: loaded.revision + 1,
      commitId: crypto.randomUUID(),
      game,
    });
    raw = encodeStored(save, loaded.sourceRaw);
  } catch (error) {
    return { ...loaded, status: 'invalid', error: importError(error) };
  }
  try {
    if (storage.getItem(slotKey(loaded.activeSlot)) !== loaded.raw)
      return { ...loaded, status: 'conflict' };
    storage.setItem(slotKey(loaded.activeSlot), raw);
    return {
      ...loaded,
      game,
      revision: loaded.revision + 1,
      raw,
      status: 'ready',
      empty: false,
      dirty: false,
      error: undefined,
    };
  } catch {
    return {
      ...loaded,
      game,
      status: 'unavailable',
      empty: false,
      dirty: true,
    };
  }
}
export interface SlotSummary extends LoadedSave {
  slotId: SlotId;
}
export function readSlots(
  storage: GameStorage,
  now: number,
  fast: boolean,
): SlotSummary[] {
  return SAVES.slots.map((slotId) => ({
    ...loadGame(storage, now, fast, slotId),
    slotId,
  }));
}
export function isSaveKey(key: string | null) {
  return key === null || SAVES.slots.some((id) => slotKey(id) === key);
}

export function browserStorage(): GameStorage {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => {
      if (!navigator.locks)
        throw new DOMException(
          'Safe storage requires Web Locks',
          'NotSupportedError',
        );
      window.localStorage.setItem(key, value);
    },
  };
}
export function readSelection(selection?: GameStorage): SlotId {
  try {
    const value = selection?.getItem(SAVES.selectionKey);
    return SAVES.slots.find((id) => id === value) ?? SAVES.slots[0];
  } catch {
    return SAVES.slots[0];
  }
}
export function browserSelection(): GameStorage {
  return {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
  };
}
