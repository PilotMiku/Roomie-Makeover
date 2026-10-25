import { describe, expect, it } from 'vitest';
import { completedGame } from '../test/completedGame';
import { createGame } from './initial';
import { syncProgress } from './progress';
import { startNewRun } from './newRun';
import { gameSchema } from './model';
import { decodeSave } from './migrations';
import { exportArchive, previewImport } from './saves';
import { oldM7Game, oldCompactArchive } from '../test/oldSave';
import { changeWardrobe } from './wardrobe';
import { queuedEvent } from '../test/eventGame';
import { chooseEvent } from './events';
import { GAME } from '../data/constants';

describe('M7 achievements, albums and new runs', () => {
  it('keeps all collected portraits at capacity and can still update an existing profile', () => {
    const game = syncProgress(createGame(1000));
    const portrait = game.legacy.portraits[0]!;
    game.legacy.portraits = Array.from(
      { length: GAME.maxPortraits },
      (_, index) => ({
        ...portrait,
        id: `archived-${index}`,
        name: '旧日室友',
      }),
    );
    const before = structuredClone(game.legacy.portraits);
    expect(syncProgress(game).legacy.portraits).toEqual(before);
    game.characters[0]!.id = 'archived-0';
    game.characters[0]!.name = '新的名字';
    const updated = syncProgress(game);
    expect(updated.legacy.portraits).toHaveLength(GAME.maxPortraits);
    expect(updated.legacy.portraits[0]!.name).toBe('新的名字');
    expect(updated.legacy.portraits.slice(1)).toEqual(before.slice(1));
    expect(gameSchema.safeParse(updated).success).toBe(true);
  });
  it('records achievements and live portraits idempotently and retains departed roommates', () => {
    const game = createGame(1000);
    const collected = syncProgress(game);
    expect(collected.legacy.achievements).toEqual(['first-home']);
    expect(collected.legacy.portraits).toHaveLength(4);
    expect(syncProgress(collected)).toBe(collected);
    const changed = structuredClone(collected);
    changed.characters[0]!.name = '粉色新名字';
    changed.characters[0]!.appearance.topColor = '#ffaaaa';
    changed.characters.pop();
    const updated = syncProgress(changed);
    expect(updated.legacy.portraits).toHaveLength(4);
    expect(updated.legacy.portraits[0]!.name).toBe('粉色新名字');
    expect(updated.legacy.portraits[0]!.appearance.topColor).toBe('#ffaaaa');
    expect(collected.legacy.portraits[0]!.name).toBe(game.characters[0]!.name);
  });
  it('collects wardrobe and completed events, without treating a queued branch as an experienced outcome', () => {
    let game = queuedEvent();
    expect(syncProgress(game).legacy.encyclopedia).not.toContain(
      'event:ribbon-studio',
    );
    const pending = game.pendingEvents.find(
      (event) => event.eventId === 'ribbon-studio',
    )!;
    game = chooseEvent(game, {
      instanceId: pending.id,
      choiceId: 'photo',
    }).game;
    expect(game.legacy.encyclopedia).toContain('event:ribbon-studio');
    game = changeWardrobe(game, {
      type: 'save-preset',
      characterId: game.characters[0]!.id,
      name: '棉花糖',
    }).game;
    expect(game.legacy.achievements).toContain('first-look');
    expect(game.legacy.encyclopedia).toContain('clothing:cream-buns');
  });
  it('requires both 90 progress and 30 settlements in this run, including after a previous completed run', () => {
    const game = createGame(1000);
    game.characters[0]!.stats.progress = 100;
    expect(() => startNewRun(game, 2000, false)).toThrow();
    const completed = completedGame();
    expect(completed.legacy.achievements).toContain('graduate');
    completed.characters[0]!.stats.progress = 99;
    for (const character of completed.characters.slice(1))
      character.stats.progress = 0;
    expect(() => startNewRun(completed, 2000, false)).toThrow();
    const next = startNewRun(completedGame(), 2000, true);
    expect(() => startNewRun(next, 3000, true)).toThrow();
  });
  it('resets only transient story fields while preserving the complete collection and run count', () => {
    const game = completedGame();
    game.settings.sound = true;
    const before = structuredClone(game);
    const next = startNewRun(game, 5000, true);
    expect(next.day).toBe(1);
    expect(next.lastSettledDay).toBe(0);
    expect(next.setup).toBe('identity');
    expect(next.characters).toEqual([]);
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0]!.capacity).toBe(4);
    expect(next.pendingEvents).toEqual([]);
    expect(next.resolvedEventIds).toEqual([]);
    expect(next.logs).toEqual([]);
    expect(next.wardrobe.presets).toEqual([]);
    expect(next.settings).toEqual({ sound: true, roleplay: false });
    expect(next.clock).toEqual({
      anchor: 5000,
      lastObserved: 5000,
      mode: 'fast',
    });
    expect(next.slotId).toBe(game.slotId);
    expect(next.name).toBe(game.name);
    expect(next.legacy.runs).toBe(1);
    expect(next.legacy.achievements).toEqual(
      expect.arrayContaining([...game.legacy.achievements, 'second-story']),
    );
    expect(next.legacy.encyclopedia).toEqual(game.legacy.encyclopedia);
    expect(next.legacy.portraits).toEqual(game.legacy.portraits);
    expect(game).toEqual(before);
    expect(gameSchema.safeParse(next).success).toBe(true);
    expect(previewImport(exportArchive(next)).game).toEqual(next);
  });
  it('validates an actual 1.3 plain or compact archive before adding the new album field', () => {
    const game = completedGame();
    const oldGame = oldM7Game(game);
    const { portraits, ...oldLegacy } = oldGame.legacy;
    void portraits;
    const old = {
      revision: 3,
      commitId: 'm6',
      game: { ...oldGame, version: '1.3', legacy: oldLegacy },
    };
    const migrated = decodeSave(old);
    expect(migrated.game.version).toBe('1.6');
    expect(migrated.game.characters).toEqual(game.characters);
    expect(migrated.game.legacy.portraits).toEqual([]);
    expect(previewImport(oldCompactArchive(game)).game.characters).toEqual(
      game.characters,
    );
    old.game.characters[0]!.bedId = 'missing';
    expect(() => decodeSave(old)).toThrow();
  });
  it('rejects duplicate or unsafe archived portraits without poisoning the current save', () => {
    const game = syncProgress(createGame(1000));
    const original = exportArchive(game);
    for (const mutate of [
      (value: typeof game) =>
        value.legacy.portraits.push(value.legacy.portraits[0]!),
      (value: typeof game) => {
        value.legacy.portraits[0]!.outfit.hair = 'missing';
      },
      (value: typeof game) => {
        value.legacy.portraits[0]!.name = '17岁同学';
      },
    ]) {
      const invalid = structuredClone(game);
      mutate(invalid);
      expect(gameSchema.safeParse(invalid).success).toBe(false);
    }
    expect(exportArchive(game)).toBe(original);
  });
});
