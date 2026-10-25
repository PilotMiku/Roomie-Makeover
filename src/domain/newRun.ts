import { createNewGame } from './initial';
import { gameSchema, type GameState } from './model';
import { syncProgress } from './progress';
import { isComplete } from './completion';
import { nextRandom } from './random';

export function startNewRun(
  game: GameState,
  now: number,
  fast: boolean,
): GameState {
  if (
    game.setup !== 'done' ||
    !game.characters.some(isComplete) ||
    game.legacy.runs >= Number.MAX_SAFE_INTEGER
  )
    throw new Error('本周目尚未达到完成条件。');
  const collected = syncProgress(game);
  return gameSchema.parse(
    syncProgress({
      ...createNewGame(now, fast),
      slotId: game.slotId,
      name: game.name,
      player: { ...game.player },
      settings: { roleplay: false, sound: game.settings.sound },
      randomSeed: nextRandom(game.randomSeed),
      legacy: { ...collected.legacy, runs: collected.legacy.runs + 1 },
    }),
  );
}
