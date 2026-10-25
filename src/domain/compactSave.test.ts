import { describe, expect, it } from 'vitest';
import { GAME, SAVES } from '../data/constants';
import { multiRoomGame } from '../test/multiRoom';
import { queuedEvent } from '../test/eventGame';
import { oldM3Game } from '../test/oldSave';
import { createGame } from './initial';
import { encodeCompact } from './compactSave';
import { decodeStored, exportArchive, previewImport } from './saves';
import { interact } from './interactions';
import { chooseEvent } from './events';
import { settleDay } from './rules';
import { createGameStore } from '../state/game';

describe('M6 lossless compact archives', () => {
  it('preserves all log variants and sparse growth deltas while normal small archives retain the M5 format', () => {
    let game = queuedEvent();
    game = interact(game, {
      operationId: 'talk',
      characterId: 'resident-1',
      expectedDay: game.day,
      kind: 'normal',
      actionId: 'talk',
    }).game;
    const pending = game.pendingEvents.find(
      (item) => item.eventId === 'ribbon-studio',
    )!;
    game = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: 'photo',
    }).game;
    game.characters[0]!.growth.push({
      day: game.day,
      source: 'event',
      delta: { mood: 0 },
    });
    const compact = encodeCompact({ revision: 0, commitId: 'packed', game });
    expect(previewImport(compact).game).toEqual(game);
    expect(previewImport(compact).fromVersion).toBe('1.6');
    expect(JSON.parse(exportArchive(createGame(1000))).game.version).toBe(
      '1.6',
    );
  });
  it('rejects unknown encoding versions, bad row lengths, non-integers, excess entries and invalid expanded references', () => {
    const game = settleDay(createGame(1000), 1, 'manual');
    const raw = encodeCompact({ revision: 0, commitId: 'packed', game });
    const mutations = [
      (value: Record<string, unknown>) => {
        value.version = '9.0';
      },
      (value: Record<string, unknown>) => {
        value.extra = true;
      },
    ];
    for (const mutate of mutations) {
      const value = JSON.parse(raw);
      mutate(value);
      expect(() => previewImport(JSON.stringify(value))).toThrow();
    }
    for (const delta of [
      [1, 2],
      [0, 0, 0, 0, 0, 0, 0],
      [0, null, 0, 0, 0, 0],
      [0, 1.5, 0, 0, 0, 0],
      ['1', 0, 0, 0, 0, 0],
    ]) {
      const value = JSON.parse(raw);
      const dayLog = value.save.game.logs.find(
        (log: { type: string }) => log.type === 'day',
      );
      dayLog.results[0].delta = delta;
      expect(() => previewImport(JSON.stringify(value))).toThrow();
    }
    const badReference = JSON.parse(raw);
    badReference.save.game.characters[0].bedId = 'missing';
    expect(() => previewImport(JSON.stringify(badReference))).toThrow();
    const tooMany = JSON.parse(raw);
    tooMany.save.game.characters[0].growth = Array.from(
      { length: 301 },
      () => tooMany.save.game.characters[0].growth[0],
    );
    expect(() => previewImport(JSON.stringify(tooMany))).toThrow();
  });
  it('persists a full 24-person history compactly without discarding logs or the original source backup', async () => {
    localStorage.clear();
    let game = multiRoomGame();
    for (let day = 1; day <= 305; day++) game = settleDay(game, day, 'manual');
    const source =
      '\uFEFF' +
      JSON.stringify({
        revision: 1,
        commitId: 'original',
        game: oldM3Game(game),
      });
    localStorage.setItem(
      GAME.storageKey,
      encodeCompact({ revision: 1, commitId: 'full', game }, source),
    );
    const store = () =>
      createGameStore(
        localStorage,
        () => 1000,
        () => false,
        () => true,
      );
    const current = store();
    current.getState().next(game.day);
    expect(current.getState().status).toBe('ready');
    const raw = localStorage.getItem(GAME.storageKey)!;
    expect(JSON.parse(raw).format).toBe('roomdev-stats-tuples');
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThan(
      SAVES.maxImportBytes,
    );
    expect(decodeStored(JSON.parse(raw)).save.game).toEqual(
      current.getState().game,
    );
    const restored = store();
    expect((await restored.getState().exportSlot('slot-1', true)).raw).toBe(
      source,
    );
    const exported = (await restored.getState().exportSlot('slot-1')).raw!;
    expect(JSON.parse(exported).sourceRaw).toBeUndefined();
    expect(previewImport(exported).game).toEqual(restored.getState().game);
    expect(restored.getState().game.logs).toHaveLength(300);
  });
});
