import { ACHIEVEMENTS } from '../data/achievements';
import { CLOTHES } from '../data/clothes';
import { CAMPUS_EVENTS } from '../data/events';
import { GAME } from '../data/constants';
import type { GameState } from './model';
import { syncWardrobeUnlocks } from './unlocks';

export function syncProgress(game: GameState): GameState {
  const unlocked = syncWardrobeUnlocks(game);
  const achievements = new Set(unlocked.legacy.achievements);
  for (const achievement of ACHIEVEMENTS)
    if (achievement.earned(unlocked) && achievements.size < GAME.maxMetaEntries)
      achievements.add(achievement.id);
  const encyclopedia = new Set(unlocked.legacy.encyclopedia);
  for (const item of CLOTHES)
    if (unlocked.wardrobe.unlockedIds.includes(item.id))
      if (encyclopedia.size < GAME.maxMetaEntries)
        encyclopedia.add(`clothing:${item.id}`);
  for (const event of CAMPUS_EVENTS)
    if (
      unlocked.resolvedEventIds.some((id) =>
        id.startsWith(`event:${event.id}:`),
      )
    )
      if (encyclopedia.size < GAME.maxMetaEntries)
        encyclopedia.add(`event:${event.id}`);
  const portraits = new Map(
    unlocked.legacy.portraits.map((portrait) => [portrait.id, portrait]),
  );
  if (game.setup === 'done')
    for (const character of unlocked.characters) {
      if (!portraits.has(character.id) && portraits.size >= GAME.maxPortraits)
        continue;
      const { id, name, major, appearance, outfit } = character;
      portraits.set(id, {
        id,
        name,
        major,
        appearance: { ...appearance },
        outfit: { ...outfit },
      });
    }
  const legacy = {
    ...unlocked.legacy,
    achievements: [...achievements],
    encyclopedia: [...encyclopedia],
    portraits: [...portraits.values()],
  };
  if (JSON.stringify(legacy) === JSON.stringify(unlocked.legacy))
    return unlocked;
  return { ...unlocked, legacy };
}
