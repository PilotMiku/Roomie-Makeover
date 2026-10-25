import { createGame } from '../domain/initial';
import { settleDay } from '../domain/rules';

export function completedGame(now = 1000) {
  let game = createGame(now);
  for (let day = 1; day <= 34; day++) game = settleDay(game, day, 'manual');
  return game;
}
