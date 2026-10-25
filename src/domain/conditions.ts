import { GAME } from '../data/constants';
import { findClothing, OPEN_SLOTS } from '../data/clothes';
import type { Character, GameState, GameLog, Stats } from './model';
import { changeStats, statKeys } from './stats';
import { zeroStats } from './activityState';
import { addLog } from './log';

export function onLeave(character: Character, day: number) {
  return day < character.condition.leaveUntilDay;
}
export function leaveMessage(character: Character, day: number) {
  return onLeave(character, day)
    ? character.name +
        '正在请假休养，还剩 ' +
        (character.condition.leaveUntilDay - day) +
        ' 个游戏日，第 ' +
        character.condition.leaveUntilDay +
        ' 天返寝。'
    : '';
}
export type ConditionIncident = Pick<
  Extract<GameLog, { type: 'condition' }>,
  'reason' | 'delta' | 'leaveUntilDay'
>;

// Shared by previews and commits: no IDs, random draws, storage writes or input mutation.
export function evaluateCharacterConditions(original: Character, day: number) {
  if (day !== original.daily.day)
    return { character: original, incidents: [] as ConditionIncident[] };
  let character = original;
  let condition = { ...character.condition };
  const incidents: ConditionIncident[] = [];
  const incident = (
    reason: 'stamina' | 'mood' | 'energy',
    changes: Partial<Stats>,
  ) => {
    const before = character;
    character = changeStats(character, changes, day);
    const delta = zeroStats();
    const totals = { ...character.daily.changes.event };
    for (const key of statKeys) {
      delta[key] = character.stats[key] - before.stats[key];
      totals[key] += delta[key];
    }
    character = {
      ...character,
      daily: {
        ...character.daily,
        changes: { ...character.daily.changes, event: totals },
      },
      growth: [
        ...character.growth,
        { day: day, delta, source: 'event' as const },
      ].slice(-GAME.maxLogs),
    };
    incidents.push({
      reason,
      delta,
      leaveUntilDay: condition.leaveUntilDay,
    });
  };
  if (character.stats.energy === 0 && !condition.energyZero)
    incident('energy', {
      mood: -GAME.exhaustionMoodLoss,
      rapport: -GAME.exhaustionRapportLoss,
    });
  if (character.stats.mood === 0 && !condition.moodZero)
    incident('mood', {
      affection:
        Math.floor(character.stats.affection / 2) - character.stats.affection,
      progress:
        Math.floor(character.stats.progress / 2) - character.stats.progress,
    });
  if (character.stats.stamina === 0 && !condition.staminaZero) {
    condition.leaveUntilDay = Math.min(
      Number.MAX_SAFE_INTEGER,
      day + GAME.leaveDays,
    );
    incident('stamina', {});
  }
  condition = {
    ...condition,
    staminaZero: character.stats.stamina === 0,
    moodZero: character.stats.mood === 0,
    energyZero: character.stats.energy === 0,
  };
  if (incidents.length) {
    const outfit = { ...character.outfit };
    for (const slot of OPEN_SLOTS)
      if (
        (findClothing(outfit[slot])?.minProgress ?? 0) >
        character.stats.progress
      ) {
        if (slot === 'top') outfit.top = 'basic-top';
        else if (slot === 'skirt' || slot === 'accessory' || slot === 'makeup')
          outfit[slot] = null;
      }
    character = { ...character, outfit };
  }
  if (
    character !== original ||
    JSON.stringify(condition) !== JSON.stringify(original.condition)
  )
    character = { ...character, condition };
  return { character, incidents };
}

// Only a real commit creates journal IDs. Persisted zero latches prevent repeats.
export function resolveConditions(game: GameState): GameState {
  let next = game;
  for (const original of game.characters) {
    const { character, incidents } = evaluateCharacterConditions(
      original,
      game.day,
    );
    if (character === original) continue;
    next = {
      ...next,
      characters: next.characters.map((row) =>
        row.id === original.id ? character : row,
      ),
    };
    for (const incident of incidents)
      next = addLog(next, {
        ...incident,
        type: 'condition',
        id: crypto.randomUUID(),
        day: game.day,
        characterId: original.id,
      });
  }
  return next;
}
