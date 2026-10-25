import type { Character, Stats } from './model';

export function zeroStats(): Stats {
  return {
    affection: 0,
    mood: 0,
    stamina: 0,
    energy: 0,
    progress: 0,
    rapport: 0,
  };
}
export function emptyDaily(day: number): Character['daily'] {
  return {
    day,
    progressGained: 0,
    interactions: 0,
    identityParticipated: false,
    gifts: 0,
    operationIds: [],
    changes: { interaction: zeroStats(), event: zeroStats() },
  };
}
