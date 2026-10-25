import { beforeEach, describe, expect, it } from 'vitest';
import { completedGame } from '../test/completedGame';
import { createGameStore, type GameStorage } from './game';
import { exportArchive } from '../domain/saves';
import { GAME } from '../data/constants';
import { previewImport } from '../domain/saves';
import { oldM7Game } from '../test/oldSave';

beforeEach(() => localStorage.clear());
function setup(storage: GameStorage = localStorage) {
  const game = completedGame();
  localStorage.setItem(GAME.storageKey, exportArchive(game));
  localStorage.setItem(
    'roomdev:slot:2',
    exportArchive({ ...game, slotId: 'slot-2', name: '另一本日记' }),
  );
  return createGameStore(
    storage,
    () => 2000,
    () => false,
    () => true,
  );
}
function request(store: ReturnType<typeof setup>) {
  const state = store.getState();
  return {
    confirmed: true as const,
    expectedDay: state.game.day,
    expectedRuns: state.game.legacy.runs,
    expectedRevision: state.revision,
  };
}
describe('M7 atomic new-run commands', () => {
  it('keeps an embedded original backup byte-for-byte through another schema upgrade', async () => {
    const game = completedGame();
    const oldGame = oldM7Game(game);
    const { portraits, ...legacy } = oldGame.legacy;
    void portraits;
    const source =
      '\uFEFF' + JSON.stringify({ original: 'unchanged old bytes' });
    const raw = JSON.stringify({
      revision: 3,
      commitId: 'm6-with-source',
      sourceRaw: source,
      game: { ...oldGame, version: '1.3', legacy },
    });
    localStorage.setItem(GAME.storageKey, raw);
    const store = createGameStore(
      localStorage,
      () => 1000,
      () => false,
      () => true,
    );
    store.getState().initialize();
    expect(store.getState().game.version).toBe('1.6');
    expect((await store.getState().exportSlot('slot-1', true)).raw).toBe(
      source,
    );
    expect(previewImport(raw).sourceRaw).toBe(source);
  });
  it('restarts the current slot once, isolates all other slots and survives reload', async () => {
    const store = setup(),
      second = localStorage.getItem('roomdev:slot:2');
    const command = request(store);
    expect((await store.getState().newRun(command)).error).toBeUndefined();
    expect(store.getState().game.day).toBe(1);
    expect(store.getState().game.legacy.runs).toBe(1);
    expect(store.getState().generation).toBe(1);
    expect((await store.getState().newRun(command)).error).toBeTruthy();
    expect(localStorage.getItem('roomdev:slot:2')).toBe(second);
    const restored = createGameStore(
      localStorage,
      () => 2000,
      () => false,
      () => true,
    );
    expect(restored.getState().game).toEqual(store.getState().game);
  });
  it('retains the complete original story on storage quota failure', async () => {
    const store = setup({
      getItem: (key) => localStorage.getItem(key),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    const original = store.getState().game,
      raw = localStorage.getItem(GAME.storageKey);
    expect((await store.getState().newRun(request(store))).error).toBeTruthy();
    expect(store.getState().game).toBe(original);
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
    expect(store.getState().generation).toBe(0);
  });
  it('rejects an older tab before it replaces a newer story', async () => {
    const first = setup();
    const older = createGameStore(
      localStorage,
      () => 2000,
      () => false,
      () => true,
    );
    first.getState().next(first.getState().game.day);
    const raw = localStorage.getItem(GAME.storageKey);
    expect((await older.getState().newRun(request(older))).error).toBeTruthy();
    expect(older.getState().status).toBe('conflict');
    expect(localStorage.getItem(GAME.storageKey)).toBe(raw);
  });
  it('requires explicit confirmation and reliable current progress', async () => {
    const store = setup(),
      command = request(store);
    expect(
      (await store.getState().newRun({ ...command, confirmed: false as true }))
        .error,
    ).toBeTruthy();
    store.setState({ dirty: true });
    expect((await store.getState().newRun(command)).error).toBeTruthy();
    expect(store.getState().game.legacy.runs).toBe(0);
  });
});
