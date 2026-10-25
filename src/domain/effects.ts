import { ACTIVITY, GAME } from '../data/constants';
import { MAJORS } from '../data/rules';
import type { ActivityCost } from '../data/interactions';
import type { Character, GameState, Stats } from './model';
import { changeStats, clamp, statKeys } from './stats';
import { leaveMessage, resolveConditions } from './conditions';

export function effectTerms(
  character: Character,
  changes: Partial<Stats>,
  cost: ActivityCost = {},
): Stats {
  const delta = {
    affection: 0,
    mood: 0,
    stamina: 0,
    energy: 0,
    progress: 0,
    rapport: 0,
  };
  for (const key of statKeys) {
    const base = changes[key] ?? 0;
    const multiplier = clamp(
      MAJORS[character.major].multipliers[key] ?? 1,
      GAME.multiplierMin,
      GAME.multiplierMax,
    );
    delta[key] = base > 0 ? Math.round(base * multiplier) : base;
  }
  delta.energy -= cost.energy ?? 0;
  delta.stamina -= cost.stamina ?? 0;
  return delta;
}
export function costError(
  game: GameState,
  characterIds: string[],
  cost: ActivityCost = {},
): string | undefined {
  if (game.wallet.tokens < (cost.tokens ?? 0))
    return '心意点不足，可在进入下一天后领取补给。';
  for (const id of characterIds) {
    const character = game.characters.find((candidate) => candidate.id === id);
    if (!character) return '参与室友已离开，无法结算此操作。';
    const leave = leaveMessage(character, game.day);
    if (leave) return leave;
    if (character.stats.energy < (cost.energy ?? 0))
      return `${character.name}的精力不足，请选择休息或进入下一天。`;
    if (character.stats.stamina < (cost.stamina ?? 0))
      return `${character.name}的体力不足，请选择轻松活动或进入下一天。`;
  }
}
export function applyEffects(
  game: GameState,
  characterIds: string[],
  changes: Partial<Stats>,
  source: 'interaction' | 'event',
  cost: ActivityCost = {},
) {
  const results: Array<{
    characterId: string;
    delta: Stats;
    major: Character['major'];
  }> = [];
  const ids = new Set(characterIds);
  const characters = game.characters.map((character) => {
    if (!ids.has(character.id)) return character;
    const updated = changeStats(
      character,
      effectTerms(character, changes, cost),
      game.day,
    );
    const actual = { ...updated.stats };
    const totals = { ...character.daily.changes[source] };
    for (const key of statKeys) {
      actual[key] -= character.stats[key];
      totals[key] += actual[key];
    }
    results.push({
      characterId: character.id,
      delta: actual,
      major: character.major,
    });
    return {
      ...updated,
      daily: {
        ...updated.daily,
        changes: { ...updated.daily.changes, [source]: totals },
      },
      growth: [
        ...updated.growth,
        { day: game.day, delta: actual, source },
      ].slice(-GAME.maxLogs),
    };
  });
  return { game: resolveConditions({ ...game, characters }), results };
}
export function adjustTokens(game: GameState, delta: number) {
  const tokens = clamp(game.wallet.tokens + delta, 0, ACTIVITY.maxTokens);
  return {
    game: { ...game, wallet: { tokens } },
    actual: tokens - game.wallet.tokens,
  };
}
