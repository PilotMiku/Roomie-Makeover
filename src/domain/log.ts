import { GAME } from '../data/constants';
import type { GameLog, GameState } from './model';

export function addLog<T extends Pick<GameState, 'logs'>>(
  game: T,
  log: GameLog,
): T {
  return { ...game, logs: [...game.logs, log].slice(-GAME.maxLogs) };
}
