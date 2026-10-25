import type { GameState } from '../domain/model';
import { isComplete } from '../domain/completion';
import { FIRST_LOOK_EVENT } from './clothes';

export const ACHIEVEMENTS: readonly {
  id: string;
  name: string;
  icon: string;
  description: string;
  earned: (game: GameState) => boolean;
}[] = [
  {
    id: 'first-home',
    name: '小屋开张',
    icon: '🏡',
    description: '完成第一间寝室的入住。',
    earned: (game) => game.setup === 'done',
  },
  {
    id: 'first-look',
    name: '今天也可爱',
    icon: '🎀',
    description: '收藏第一套穿搭。',
    earned: (game) => game.resolvedEventIds.includes(FIRST_LOOK_EVENT),
  },
  {
    id: 'week',
    name: '一周好时光',
    icon: '🌷',
    description: '完成 7 次日结算。',
    earned: (game) => game.lastSettledDay >= 7,
  },
  {
    id: 'neighbor',
    name: '隔壁来串门',
    icon: '🍓',
    description: '拥有至少两间寝室。',
    earned: (game) => game.rooms.length >= 2,
  },
  {
    id: 'friends',
    name: '默契搭子',
    icon: '♡',
    description: '任一室友好感与默契都达到 80。',
    earned: (game) =>
      game.characters.some(
        (character) =>
          character.stats.affection >= 80 && character.stats.rapport >= 80,
      ),
  },
  {
    id: 'story',
    name: '日常收藏家',
    icon: '💌',
    description: '完成一次随机事件。',
    earned: (game) =>
      game.resolvedEventIds.some((id) => id.startsWith('event:')),
  },
  {
    id: 'graduate',
    name: '闪闪发光的你',
    icon: '✨',
    description: '任一室友进度达到 100 且完成至少 30 次日结算。',
    earned: (game) => game.characters.some(isComplete),
  },
  {
    id: 'second-story',
    name: '下一页，再见',
    icon: '📖',
    description: '开启一次新周目。',
    earned: (game) => game.legacy.runs >= 1,
  },
];
