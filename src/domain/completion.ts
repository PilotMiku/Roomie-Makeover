import { GAME } from '../data/constants';
import type { Character } from './model';

export function isComplete(character: Character) {
  return (
    character.stats.progress >= GAME.completeProgress &&
    character.settledDays >= GAME.completeDays
  );
}
