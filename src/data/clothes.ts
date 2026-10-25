export const CORE_SLOTS = ['hair', 'top', 'bottom'] as const;
export const OPEN_SLOTS = [
  ...CORE_SLOTS,
  'skirt',
  'accessory',
  'makeup',
] as const;
export type OpenSlot = (typeof OPEN_SLOTS)[number];
export type ClothingStyle = 'cute' | 'fantasy' | 'daily' | 'funny';
export type UnlockCondition =
  | { type: 'initial' }
  | { type: 'stat'; stat: 'progress' | 'affection'; minimum: number }
  | { type: 'event'; eventId: string }
  | { type: 'achievement'; achievementId: string }
  | { type: 'any'; conditions: UnlockCondition[] };
export interface Clothing {
  id: string;
  slot: OpenSlot;
  name: string;
  style: ClothingStyle;
  pattern: number;
  description: string;
  unlock: UnlockCondition;
  minProgress?: number;
}
export const FIRST_LOOK_EVENT = 'wardrobe:first-preset';
const initial: UnlockCondition = { type: 'initial' };
const progress = (minimum: number): UnlockCondition => ({
  type: 'stat',
  stat: 'progress',
  minimum,
});
const affection = (minimum: number): UnlockCondition => ({
  type: 'stat',
  stat: 'affection',
  minimum,
});
const firstLook: UnlockCondition = { type: 'event', eventId: FIRST_LOOK_EVENT };

export const CLOTHES: readonly Clothing[] = [
  {
    id: 'basic-hair-1',
    slot: 'hair',
    name: '蓬松短发',
    style: 'daily',
    pattern: 0,
    description: '被寝室的风吹得刚刚好。',
    unlock: initial,
  },
  {
    id: 'basic-hair-2',
    slot: 'hair',
    name: '柔软及肩发',
    style: 'cute',
    pattern: 1,
    description: '给普通日子留一点温柔。',
    unlock: initial,
  },
  {
    id: 'basic-hair-3',
    slot: 'hair',
    name: '清爽侧分',
    style: 'daily',
    pattern: 2,
    description: '今天也精神满满地出门。',
    unlock: initial,
  },
  {
    id: 'basic-hair-4',
    slot: 'hair',
    name: '呆毛翘翘',
    style: 'funny',
    pattern: 3,
    description: '一根永远不肯服帖的快乐呆毛。',
    unlock: initial,
  },
  {
    id: 'ribbon-tails',
    slot: 'hair',
    name: '缎带双马尾',
    style: 'cute',
    pattern: 4,
    description: '左右各收好一份可爱。',
    unlock: initial,
  },
  {
    id: 'mage-braid',
    slot: 'hair',
    name: '星月编发',
    style: 'fantasy',
    pattern: 5,
    description: '像是刚从幻想社团散场。',
    unlock: initial,
  },
  {
    id: 'cloud-waves',
    slot: 'hair',
    name: '云朵长卷发',
    style: 'fantasy',
    pattern: 6,
    description: '把成长的心事卷成云朵。',
    unlock: {
      type: 'any',
      conditions: [
        progress(15),
        { type: 'event', eventId: 'event:bathroom-mirror:continue' },
      ],
    },
  },
  {
    id: 'cream-buns',
    slot: 'hair',
    name: '奶油双丸子',
    style: 'funny',
    pattern: 7,
    description: '第一套收藏造型的甜甜纪念。',
    unlock: firstLook,
  },
  {
    id: 'basic-top',
    slot: 'top',
    name: '日常软棉衫',
    style: 'daily',
    pattern: 0,
    description: '陪你度过普通而舒服的一天。',
    unlock: initial,
  },
  {
    id: 'ribbon-blouse',
    slot: 'top',
    name: '樱桃蝴蝶结衬衫',
    style: 'cute',
    pattern: 1,
    description: '领口有一只小小的蝴蝶结。',
    unlock: initial,
  },
  {
    id: 'sailor-shirt',
    slot: 'top',
    name: '社团水手领',
    style: 'cute',
    pattern: 2,
    description: '大学社团的可爱制服。',
    unlock: initial,
  },
  {
    id: 'moon-tunic',
    slot: 'top',
    name: '月光法师上衣',
    style: 'fantasy',
    pattern: 3,
    description: '在寝室也可以扮演幻想冒险家。',
    unlock: {
      type: 'any',
      conditions: [
        progress(15),
        { type: 'event', eventId: 'event:rainy-window:decorate' },
      ],
    },
  },
  {
    id: 'cozy-hoodie',
    slot: 'top',
    name: '周末连帽衫',
    style: 'daily',
    pattern: 4,
    description: '适合窝在椅子上读书。',
    unlock: initial,
  },
  {
    id: 'star-shirt',
    slot: 'top',
    name: '星星舞台衫',
    style: 'fantasy',
    pattern: 5,
    description: '与室友熟悉之后的小舞台。',
    unlock: affection(50),
  },
  {
    id: 'duck-shirt',
    slot: 'top',
    name: '快乐小鸭衫',
    style: 'funny',
    pattern: 6,
    description: '胸前的小鸭替你宣布今天休息。',
    unlock: initial,
  },
  {
    id: 'lace-shirt',
    slot: 'top',
    name: '奶油花边衬衫',
    style: 'cute',
    pattern: 7,
    description: '为持续成长留一圈精致花边。',
    unlock: {
      type: 'any',
      conditions: [
        progress(45),
        { type: 'event', eventId: 'event:ribbon-studio:photo' },
      ],
    },
  },
  {
    id: 'basic-bottom',
    slot: 'bottom',
    name: '基础直筒长裤',
    style: 'daily',
    pattern: 0,
    description: '干净的轮廓，怎么搭都舒服。',
    unlock: initial,
  },
  {
    id: 'ribbon-shorts',
    slot: 'bottom',
    name: '蝴蝶结短裤',
    style: 'cute',
    pattern: 1,
    description: '裤脚藏着小小的缎带。',
    unlock: initial,
  },
  {
    id: 'star-bloomers',
    slot: 'bottom',
    name: '星月灯笼裤',
    style: 'fantasy',
    pattern: 2,
    description: '蓬松又利落的幻想社团装束。',
    unlock: initial,
  },
  {
    id: 'cloud-trousers',
    slot: 'bottom',
    name: '云朵阔腿裤',
    style: 'daily',
    pattern: 3,
    description: '让每一步都轻轻松松。',
    unlock: initial,
  },
  {
    id: 'checker-trousers',
    slot: 'bottom',
    name: '棋盘格长裤',
    style: 'funny',
    pattern: 4,
    description: '走进寝室，仿佛走进棋盘。',
    unlock: initial,
  },
  {
    id: 'candy-shorts',
    slot: 'bottom',
    name: '糖果滚边短裤',
    style: 'cute',
    pattern: 5,
    description: '熟悉的室友，甜甜的日常。',
    unlock: affection(50),
  },
  {
    id: 'mage-trousers',
    slot: 'bottom',
    name: '星旅骑士长裤',
    style: 'fantasy',
    pattern: 6,
    description: '为下一段小冒险准备。',
    unlock: progress(15),
  },
  {
    id: 'duck-stripes',
    slot: 'bottom',
    name: '小鸭条纹裤',
    style: 'funny',
    pattern: 7,
    description: '穿搭纪念事件送来的快乐条纹。',
    unlock: firstLook,
  },
  {
    id: 'petal-skirt',
    slot: 'skirt',
    name: '樱花百褶裙',
    style: 'cute',
    pattern: 8,
    description: '展开的裙摆、百褶与白色蕾丝下摆。',
    unlock: progress(50),
    minProgress: 50,
  },
  {
    id: 'star-dress',
    slot: 'skirt',
    name: '星月蓬蓬裙',
    style: 'fantasy',
    pattern: 9,
    description: '层叠纱裙、金色星点与腰间大蝴蝶结。',
    unlock: progress(50),
    minProgress: 50,
  },
  {
    id: 'maid-blouse',
    slot: 'top',
    name: '经典女仆泡泡袖',
    style: 'cute',
    pattern: 8,
    description: '黑色泡泡袖、白色领片和醒目的胸前缎带。',
    unlock: progress(100),
    minProgress: 100,
  },
  {
    id: 'maid-skirt',
    slot: 'skirt',
    name: '黑白蕾丝女仆裙',
    style: 'cute',
    pattern: 10,
    description: '大裙摆、白围裙、荷叶边与配套长袜。',
    unlock: progress(100),
    minProgress: 100,
  },
  {
    id: 'ribbon-crown',
    slot: 'accessory',
    name: '樱桃大蝴蝶结',
    style: 'cute',
    pattern: 8,
    description: '发顶醒目的粉色缎带。',
    unlock: progress(50),
    minProgress: 50,
  },
  {
    id: 'maid-headband',
    slot: 'accessory',
    name: '蕾丝女仆头饰',
    style: 'cute',
    pattern: 9,
    description: '黑色发箍与一整排白色荷叶边。',
    unlock: progress(100),
    minProgress: 100,
  },
  {
    id: 'rose-makeup',
    slot: 'makeup',
    name: '桃粉腮红妆',
    style: 'cute',
    pattern: 8,
    description: '桃粉腮红、唇色与亮晶晶眼睛。',
    unlock: progress(50),
    minProgress: 50,
  },
  {
    id: 'doll-makeup',
    slot: 'makeup',
    name: '精致人偶妆',
    style: 'fantasy',
    pattern: 9,
    description: '明显的睫毛、玫瑰唇色和双颊高光。',
    unlock: progress(100),
    minProgress: 100,
  },
];
export const INITIAL_CLOTHES = CLOTHES.filter(
  (item) => item.unlock.type === 'initial',
).map((item) => item.id);
export const SLOT_LABELS: Record<OpenSlot, string> = {
  hair: '发型',
  top: '上衣',
  bottom: '下装',
  skirt: '裙装',
  accessory: '配饰',
  makeup: '妆容',
};
export const STYLE_LABELS: Record<ClothingStyle, string> = {
  cute: '可爱制服',
  fantasy: '幻想',
  daily: '日常',
  funny: '搞怪',
};
export const RESERVED_SLOTS = ['外套', '鞋', '袜', '高级配色'] as const;
export const DEFAULT_BOTTOM_COLOR = '#9b78b6';
export const DEFAULT_OUTFIT_COLORS = {
  hairColor: '#755267',
  topColor: '#ed9fc0',
  bottomColor: DEFAULT_BOTTOM_COLOR,
};
export const WARDROBE = {
  maxPresets: 50,
  cacheLimit: 96,
  nameLimit: 40,
} as const;
export function findClothing(id: string | null | undefined) {
  return CLOTHES.find((item) => item.id === id);
}
