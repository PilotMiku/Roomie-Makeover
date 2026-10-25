import { GAME, STAT_LABELS } from '../data/constants';
import type { Character, Stats, StatKey } from './model';

export const statKeys = Object.keys(STAT_LABELS) as StatKey[];
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// All sources share this positive-progress ledger. Negative changes never refund it.
export function changeStats(
  character: Character,
  requested: Partial<Stats>,
  day: number,
): Character {
  if (day !== character.daily.day) return character;
  const stats = { ...character.stats };
  let progressGained = character.daily.progressGained;
  for (const key of statKeys) {
    const value = requested[key] ?? 0;
    if (!Number.isFinite(value)) continue;
    let delta = Math.round(value);
    if (key === 'progress' && delta > 0) {
      delta = Math.min(
        delta,
        GAME.dailyProgress - progressGained,
        GAME.statMax - stats.progress,
      );
      progressGained += delta;
    }
    stats[key] = clamp(stats[key] + delta, GAME.statMin, GAME.statMax);
  }
  return { ...character, stats, daily: { ...character.daily, progressGained } };
}
