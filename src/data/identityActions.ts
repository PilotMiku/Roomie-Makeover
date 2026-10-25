import type { GameState, Stats } from '../domain/model';
import type { ActivityCost } from './interactions';
export const IDENTITY_ACTIONS: readonly {
  id: string;
  name: string;
  identities: GameState['player']['identity'][];
  text: string;
  cost: ActivityCost;
  delta: Partial<Stats>;
  habitability: number;
}[] = [
  {
    id: 'cleanup',
    name: '发动寝室大扫除',
    identities: ['leader'],
    text: '大家商量好分工，一起整理公共区域，寝室焕然一新。',
    cost: { stamina: 6, energy: 3 },
    delta: { mood: 3, affection: 2, rapport: 3 },
    habitability: 12,
  },
  {
    id: 'inspection',
    name: '预约查寝',
    identities: ['warden', 'manager', 'counselor'],
    text: '提前约定好时间，只查看公共设施与安全隐患，尊重大家的个人穿搭。',
    cost: { stamina: 2, energy: 2 },
    delta: { mood: 1, rapport: 2 },
    habitability: 6,
  },
  {
    id: 'family-call',
    name: '打电话问候',
    identities: ['parent'],
    text: '约好方便的时间通话，听听校园趣事，也分享家里的近况。',
    cost: { energy: 2 },
    delta: { affection: 4, mood: 3, rapport: 3 },
    habitability: 0,
  },
  {
    id: 'family-visit',
    name: '预约探望',
    identities: ['parent'],
    text: '征得大家同意后带着水果来探望，聊聊生活、一起整理桌面。',
    cost: { stamina: 2, energy: 2 },
    delta: { affection: 4, mood: 5, rapport: 3 },
    habitability: 4,
  },
  {
    id: 'study-pair',
    name: '室友学习搭子',
    identities: ['member'],
    text: '互相检查当天的小计划，顺便交流喜欢的造型。',
    cost: { energy: 4 },
    delta: { mood: 2, rapport: 3, progress: 1 },
    habitability: 2,
  },
  {
    id: 'neighbor-tea',
    name: '隔壁茶话会',
    identities: ['neighbor'],
    text: '带着小点心来串门，大家交换校园消息与换装灵感。',
    cost: { tokens: 4, energy: 2 },
    delta: { mood: 4, affection: 2, rapport: 3 },
    habitability: 2,
  },
  {
    id: 'daily-notes',
    name: '分享日常观察',
    identities: ['observer'],
    text: '分享今天观察到的温暖小事，给室友一点鼓励。',
    cost: { energy: 1 },
    delta: { mood: 2, rapport: 1 },
    habitability: 1,
  },
  {
    id: 'custom-plan',
    name: '一起安排小计划',
    identities: ['custom'],
    text: '和室友商量一件轻松的小事，按彼此舒服的节奏完成。',
    cost: { energy: 3, stamina: 2 },
    delta: { affection: 2, rapport: 2, mood: 2 },
    habitability: 5,
  },
];
export const findIdentityAction = (id: string) =>
  IDENTITY_ACTIONS.find((action) => action.id === id);
