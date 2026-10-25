import { ACTIVITY } from '../data/constants';
import type { ActivityCost } from '../data/interactions';
import type { GameState, Stats } from './model';
import { evaluateCharacterConditions } from './conditions';
import { effectTerms } from './effects';
import { changeStats, clamp, statKeys } from './stats';

export interface EffectRequest {
  characterIds: string[];
  changes: Partial<Stats>;
  cost?: ActivityCost;
  tokenChange?: number;
  roomChange?: { roomId: string; delta: number };
}
export function previewEffects(game: GameState, request: EffectRequest) {
  const ids = new Set(request.characterIds);
  const residents = game.characters.flatMap((original) => {
    const affected = ids.has(original.id);
    const changed = affected
      ? changeStats(
          original,
          effectTerms(original, request.changes, request.cost),
          game.day,
        )
      : original;
    const { character, incidents } = evaluateCharacterConditions(
      changed,
      game.day,
    );
    if (!affected && !incidents.length) return [];
    const delta = { ...character.stats };
    for (const key of statKeys) delta[key] -= original.stats[key];
    return [
      {
        characterId: original.id,
        name: original.name,
        before: original.stats,
        after: character.stats,
        delta,
        incidents,
        outfitStored:
          JSON.stringify(original.outfit) !== JSON.stringify(character.outfit),
      },
    ];
  });
  const tokens = clamp(
    game.wallet.tokens + (request.tokenChange ?? -(request.cost?.tokens ?? 0)),
    0,
    ACTIVITY.maxTokens,
  );
  const room = game.rooms.find((row) => row.id === request.roomChange?.roomId);
  return {
    residents,
    tokens,
    room:
      room && request.roomChange
        ? {
            name: room.name,
            before: room.habitability,
            after: clamp(room.habitability + request.roomChange.delta, 0, 100),
          }
        : undefined,
  };
}
