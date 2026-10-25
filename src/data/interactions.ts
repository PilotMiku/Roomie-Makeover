import type { Stats } from '../domain/model';

export type ActivityCost = {
  energy?: number;
  stamina?: number;
  tokens?: number;
};
export const INTERACTION_IDS = [
  'talk',
  'tidy',
  'stretch',
  'roleplay',
  'nap',
  'meal',
  'walk',
  'comfort',
] as const;
export type InteractionId = (typeof INTERACTION_IDS)[number];
export const GIFT_IDS = ['bookmark', 'tea', 'ribbon'] as const;
export type GiftId = (typeof GIFT_IDS)[number];
interface Interaction {
  id: InteractionId;
  name: string;
  roleplayName?: string;
  text: string;
  roleplayText?: string;
  cost: ActivityCost;
  delta: Partial<Stats>;
  consentRequired?: boolean;
  recovery?: boolean;
}
export const INTERACTIONS: readonly Interaction[] = [
  {
    id: 'nap',
    name: '午睡片刻',
    recovery: true,
    text: '收好手边的事情，安心小睡一会儿，精神慢慢回来了。',
    cost: {},
    delta: { energy: 12, stamina: 4, mood: 2 },
  },
  {
    id: 'meal',
    name: '食堂加餐',
    recovery: true,
    text: '去食堂认真吃一顿热乎的饭，再带着暖暖的好心情回寝。',
    cost: { tokens: 6 },
    delta: { stamina: 12, energy: 5, mood: 3 },
  },
  {
    id: 'walk',
    name: '校园散步',
    recovery: true,
    text: '沿着校园小路走一圈，吹吹风，把烦心事暂时放下。',
    cost: { stamina: 3 },
    delta: { mood: 9, energy: 4 },
  },
  {
    id: 'comfort',
    name: '室友安慰',
    recovery: true,
    text: '找个安静的角落，认真听完烦心事，给彼此一点温柔的支持。',
    cost: { energy: 2 },
    delta: { mood: 8, affection: 1 },
  },

  {
    id: 'talk',
    name: '聊聊今天',
    text: '认真听对方讲完今天的小事，一起笑了起来。',
    cost: { energy: 3 },
    delta: { affection: 2, mood: 3, rapport: 1 },
  },
  {
    id: 'tidy',
    name: '桌面整理接力',
    roleplayName: '自愿男仆整理体验',
    text: '邀请室友一起进行桌面整理接力，谁先找到那支笔谁就赢。',
    roleplayText:
      '双方自愿开启轻量男仆整理体验，边整理边交换冷笑话，随时可以结束。',
    cost: { energy: 2, stamina: 4 },
    delta: { mood: 2, rapport: 2, progress: 1 },
  },
  {
    id: 'stretch',
    name: '一起伸个懒腰',
    text: '暂停手里的事情，做了一轮轻松的伸展。',
    cost: { stamina: 1 },
    delta: { energy: 8, mood: 2, rapport: 1 },
  },
  {
    id: 'roleplay',
    name: '共同约定小任务',
    roleplayName: '自愿角色扮演小游戏',
    text: '平等地约定一件寝室小任务，一起完成后互相击掌。',
    roleplayText:
      '两位室友自愿约定轻量主人/男仆角色游戏，只完成一件普通寝室小任务，任何一方都可随时退出。',
    cost: { energy: 3, stamina: 3 },
    delta: { affection: 2, rapport: 3, progress: 1 },
    consentRequired: true,
  },
];
export const GIFTS: readonly {
  id: GiftId;
  name: string;
  text: string;
  cost: ActivityCost;
  delta: Partial<Stats>;
}[] = [
  {
    id: 'bookmark',
    name: '手写书签',
    text: '送出写着鼓励话语的书签，纸上的小爱心也被认真收好。',
    cost: { tokens: 4, energy: 1 },
    delta: { affection: 3, mood: 2, rapport: 1 },
  },
  {
    id: 'tea',
    name: '草莓热茶',
    text: '递上一杯草莓热茶，普通的下午也变得暖暖的。',
    cost: { tokens: 6, energy: 1 },
    delta: { affection: 4, mood: 4, stamina: 2 },
  },
  {
    id: 'ribbon',
    name: '缎带便签包',
    text: '送出一包缎带便签，对方决定用它记录今天的可爱瞬间。',
    cost: { tokens: 8, energy: 2 },
    delta: { affection: 4, rapport: 3, progress: 1 },
  },
];
