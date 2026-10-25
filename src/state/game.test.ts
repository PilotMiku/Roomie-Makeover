import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME } from '../data/constants';
import { createGameStore, loadGame, writeGame, type GameStorage } from './game';
import { settleDay } from '../domain/rules';
import { createGame } from '../domain/initial';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    GAME.storageKey,
    JSON.stringify({
      revision: 1,
      commitId: 'fixture',
      game: createGame(1000),
    }),
  );
});
describe('single slot persistence contract', () => {
  it('restores day, bed positions, appearance and unlocked data across a fresh store', () => {
    const store = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    store.getState().initialize();
    store.getState().move('resident-1', 'room-101-bed-2');
    store.getState().next(1);
    const restored = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    expect(restored.getState().game).toEqual(store.getState().game);
    expect(restored.getState().game.day).toBe(2);
    expect(restored.getState().game.characters[0]!.bedId).toBe(
      'room-101-bed-2',
    );
    expect(restored.getState().status).toBe('ready');
  });
  it.each([
    '{bad-json',
    '{"revision":0,"commitId":"future","game":{"version":"9.0"}}',
  ])(
    'preserves invalid or future data verbatim and locks actions: %s',
    (raw) => {
      localStorage.setItem(GAME.storageKey, raw);
      const store = createGameStore(
        localStorage,
        () => 1000,
        () => false,
        () => true,
      );
      store.getState().initialize();
      store.getState().next(1);
      store.getState().move('resident-1', 'room-101-bed-2');
      expect(store.getState().status).toBe('invalid');
      expect(store.getState().raw).toBe(raw);
      expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    },
  );
  it('blocks a stale tab before overwriting newer data', () => {
    const first = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    first.getState().initialize();
    const second = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    first.getState().next(1);
    const newest = localStorage.getItem(GAME.storageKey);
    second.getState().move('resident-1', 'room-101-bed-2');
    expect(second.getState().status).toBe('conflict');
    expect(second.getState().game.day).toBe(1);
    expect(localStorage.getItem(GAME.storageKey)).toBe(newest);
  });
  it('recognizes external deletion and storage events as conflicts', () => {
    const store = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    store.getState().initialize();
    localStorage.removeItem(GAME.storageKey);
    store.getState().detectConflict();
    expect(store.getState().status).toBe('conflict');
  });
  it('reports quota failures while retaining progress in memory and can retry', () => {
    localStorage.clear();
    const storage: GameStorage = {
      getItem: (key) => localStorage.getItem(key),
      setItem: vi.fn(() => {
        throw new DOMException('full', 'QuotaExceededError');
      }),
    };
    const loaded = loadGame(storage, 1000, false);
    const changed = settleDay(loaded.game, 1, 'manual');
    const failed = writeGame(storage, loaded, changed);
    expect(failed.status).toBe('unavailable');
    expect(failed.game.day).toBe(2);
    expect(failed.raw).toBe(null);
    storage.setItem = (key, value) => localStorage.setItem(key, value);
    expect(writeGame(storage, failed, changed).status).toBe('ready');
  });
  it('handles access denial without deleting storage', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: vi.fn(),
    };
    expect(loadGame(storage, 1000, false).status).toBe('unavailable');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('caps offline settlement immediately on initialization and rejects stale day requests', () => {
    const first = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    first.getState().initialize();
    const restored = createGameStore(
      localStorage,
      () => 1000 + GAME.normalInterval * 10 + 5,
      () => false,
      () => true,
    );
    restored.getState().initialize();
    expect(restored.getState().game.day).toBe(8);
    expect(restored.getState().notice).toContain('3 天已舍弃');
    restored.getState().next(1);
    expect(restored.getState().game.day).toBe(8);
    expect(loadGame(localStorage, 1000, false).game.day).toBe(8);
  });
});
