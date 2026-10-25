import {
  CLOTHES,
  FIRST_LOOK_EVENT,
  type UnlockCondition,
} from '../data/clothes';
import type { GameState } from './model';
import { addLog } from './log';
type UnlockGame = Pick<
  GameState,
  'wardrobe' | 'resolvedEventIds' | 'logs' | 'day'
> & {
  characters: Array<Pick<GameState['characters'][number], 'stats'>>;
  legacy: Pick<GameState['legacy'], 'achievements'>;
};

export function conditionMet(
  game: UnlockGame,
  condition: UnlockCondition,
): boolean {
  if (condition.type === 'initial') return true;
  if (condition.type === 'any')
    return condition.conditions.some((child) => conditionMet(game, child));
  if (condition.type === 'stat')
    return game.characters.some(
      (character) => character.stats[condition.stat] >= condition.minimum,
    );
  if (condition.type === 'event')
    return game.resolvedEventIds.includes(condition.eventId);
  return game.legacy.achievements.includes(condition.achievementId);
}
export function unlockDescription(condition: UnlockCondition): string {
  if (condition.type === 'initial') return '初始可用';
  if (condition.type === 'any')
    return condition.conditions.map(unlockDescription).join('，或');
  if (condition.type === 'stat')
    return `任一室友${condition.stat === 'progress' ? '男娘进度' : '好感'}达到 ${condition.minimum}`;
  if (condition.type === 'event')
    return condition.eventId === FIRST_LOOK_EVENT
      ? '保存首套搭配，触发「第一套造型」纪念事件'
      : condition.eventId === 'event:bathroom-mirror:continue'
        ? '完成「镜子边的云朵发型」事件'
        : condition.eventId === 'event:ribbon-studio:photo'
          ? '在「缎带小舞台」自愿尝试新造型'
          : condition.eventId === 'event:rainy-window:decorate'
            ? '在「虚构雨天的窗边约定」装饰便签窗'
            : '完成对应的日常事件';
  return '完成对应成就或彩蛋';
}
export function syncWardrobeUnlocks<T extends UnlockGame>(game: T): T {
  const earned = CLOTHES.filter(
    (item) =>
      !game.wardrobe.unlockedIds.includes(item.id) &&
      conditionMet(game, item.unlock),
  ).map((item) => item.id);
  if (!earned.length) return game;
  const updated = {
    ...game,
    wardrobe: {
      ...game.wardrobe,
      unlockedIds: [...game.wardrobe.unlockedIds, ...earned],
    },
  };
  return addLog(updated, {
    id: crypto.randomUUID(),
    type: 'wardrobe',
    day: game.day,
    action: 'unlock',
    characterId: null,
    itemIds: earned,
    presetName: null,
  });
}
