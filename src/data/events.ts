import type { Character, GameState, Stats } from '../domain/model';
import type { ActivityCost } from './interactions';

export interface EventCondition {
  minDay: number;
  dayModulo?: { period: number; remainder: number };
  bathrooms?: Array<'private' | 'shared' | 'none'>;
  dryWet?: boolean;
  majors?: Character['major'][];
  minAffection?: number;
  minProgress?: number;
  identities?: GameState['player']['identity'][];
  tags?: string[];
}
export interface EventOutcome {
  id: string;
  label: string;
  text: string;
  delta: Partial<Stats>;
  cost?: ActivityCost;
  tokens: number;
  habitability?: number;
}
export interface CampusEvent {
  id: string;
  title: string;
  text: string;
  roleplayText?: string;
  condition: EventCondition;
  scope: 'one' | 'room';
  branch: boolean;
  outcomes: EventOutcome[];
}
export const CAMPUS_EVENTS: readonly CampusEvent[] = [
  {
    id: 'campus-lucky-draw',
    title: '校园集章小幸运',
    text: '路过社团摊位，随手集齐的小印章换来一份小奖品。',
    condition: { minDay: 2 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'prize',
        label: '收下小奖品',
        text: '今天的好运气也分给室友一点。',
        delta: { mood: 5, affection: 2 },
        tokens: 6,
      },
    ],
  },
  {
    id: 'sunny-walk',
    title: '晒到刚刚好的太阳',
    text: '课间散步碰上暖暖的阳光，积攒了一点精神。',
    condition: { minDay: 2 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'sunshine',
        label: '收好晴天',
        text: '轻松走一圈，回寝时精神好多了。',
        delta: { stamina: 6, energy: 6, mood: 4 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'outfit-compliment',
    title: '一张真诚的夸夸便签',
    text: '室友在桌上留了便签，夸你今天的搭配很有自己的想法。',
    condition: { minDay: 2 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'thanks',
        label: '开心收下',
        text: '喜欢的风格被温柔看见，也更有信心了。',
        delta: { affection: 3, rapport: 2, mood: 5, progress: 1 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'deadline-surprise',
    title: '突然想起的作业截止',
    text: '翻开课表才发现，有一份作业比记忆里早交一天。',
    condition: { minDay: 2 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'rush',
        label: '赶完小作业',
        text: '总算按时交上，精神和心情都消耗了一些。',
        delta: { energy: -8, mood: -7 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'water-spill',
    title: '水杯打翻的小插曲',
    text: '公共桌面上的水杯不小心碰倒，大家花了一会儿收拾。',
    condition: { minDay: 2 },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'wipe',
        label: '擦干桌面',
        text: '没有东西损坏，但这次小意外留下了一点凌乱。',
        delta: { stamina: -4, energy: -3, mood: -5 },
        habitability: -8,
        tokens: 0,
      },
    ],
  },
  {
    id: 'missing-key',
    title: '找钥匙大作战',
    text: '钥匙在书包夹层里躲了很久，还多跑了一趟取件点。',
    condition: { minDay: 2 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'found',
        label: '终于找到了',
        text: '出门计划被打断，花掉一点心意点补买挂绳。',
        delta: { mood: -9, energy: -3 },
        tokens: -4,
      },
    ],
  },
  {
    id: 'power-outage',
    title: '短暂停电的晚上',
    text: '校园临时检修，寝室的灯暂时熄灭，今晚的计划需要调整。',
    condition: { minDay: 3 },
    scope: 'room',
    branch: true,
    outcomes: [
      {
        id: 'continue',
        label: '用台灯继续学习',
        text: '互相提醒进度，稍微累了一点。',
        cost: { energy: 6 },
        delta: { mood: -4, rapport: 3, progress: 1 },
        tokens: 0,
      },
      {
        id: 'rest',
        label: '顺势早点休息',
        text: '检查好安全后，给大家放一个安静的早睡夜。',
        delta: { energy: 8, stamina: 3, mood: 2 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'campus-fair',
    title: '周末校园小集市',
    text: '校园集市发来邀请，出门热闹一下还是留在寝室放松？',
    condition: { minDay: 3 },
    scope: 'one',
    branch: true,
    outcomes: [
      {
        id: 'join',
        label: '逛一圈小集市',
        text: '心情很好，脚步也走累了。',
        delta: { mood: 7, stamina: -8, affection: 2 },
        tokens: 4,
      },
      {
        id: 'stay',
        label: '留在寝室放松',
        text: '泡一杯水，和室友轻松聊聊。',
        delta: { energy: 3, affection: 1 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'leader-cleaning-day',
    title: '寝室长的周末清洁计划',
    text: '寝室长提议大家一起商量公共区域的整理。',
    condition: { minDay: 2, identities: ['leader'] },
    scope: 'room',
    branch: true,
    outcomes: [
      {
        id: 'clean',
        label: '自愿分工大扫除',
        text: '一起收拾后，房间清爽，彼此也更熟悉。',
        delta: { mood: 3, rapport: 3, affection: 2 },
        cost: { stamina: 4 },
        tokens: 0,
        habitability: 10,
      },
      {
        id: 'plan',
        label: '先写下分工计划',
        text: '今天先商量好，不急着动手。',
        delta: { rapport: 1 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'warden-room-check',
    title: '提前约好的查寝时间',
    text: '宿管带来公共设施检查清单，大家约好时间一起看看。',
    condition: { minDay: 2, identities: ['warden', 'manager'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '一起排查设施',
        text: '修好了松动的挂钩，给公共区域留出通道。',
        delta: { mood: 2, rapport: 2 },
        cost: { stamina: 1 },
        tokens: 0,
        habitability: 7,
      },
    ],
  },
  {
    id: 'counselor-checkin',
    title: '辅导员的寝室近况问候',
    text: '辅导员按约来聊聊学习与寝室生活，大家自由表达自己的安排。',
    condition: { minDay: 2, identities: ['counselor'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '交流生活近况',
        text: '把公共空间的小问题写进待办，也交换了学习建议。',
        delta: { affection: 2, rapport: 2, mood: 3 },
        cost: { energy: 1 },
        tokens: 0,
        habitability: 5,
      },
    ],
  },
  {
    id: 'parent-weekend-call',
    title: '家里打来的周末电话',
    text: '家里想听听这周的校园趣事。',
    condition: { minDay: 2, identities: ['parent'] },
    scope: 'one',
    branch: true,
    outcomes: [
      {
        id: 'call',
        label: '现在方便，聊一会儿',
        text: '相互分享近况，心里暖暖的。',
        delta: { affection: 4, mood: 4, rapport: 2 },
        cost: { energy: 1 },
        tokens: 0,
      },
      {
        id: 'later',
        label: '约好稍后再聊',
        text: '尊重彼此的时间，留下了一句问候。',
        delta: { mood: 1, rapport: 1 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'parent-campus-visit',
    title: '带水果来的校园探望',
    text: '家长提前约好探望时间，也询问室友们是否方便一起坐坐。',
    condition: { minDay: 3, identities: ['parent'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '一起分享水果',
        text: '聊聊校园生活，还顺手整理了公共餐桌。',
        delta: { affection: 3, mood: 5, rapport: 2 },
        tokens: 2,
        habitability: 3,
      },
    ],
  },
  {
    id: 'roommate-style-notes',
    title: '室友的搭配灵感本',
    text: '大家分享喜欢的颜色和社团服装，各自决定今天想尝试什么。',
    condition: {
      minDay: 2,
      identities: ['member', 'neighbor', 'custom', 'observer'],
    },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '交换搭配灵感',
        text: '把新的灵感记下来，慢慢找到喜欢的风格。',
        delta: { mood: 3, rapport: 2, progress: 1 },
        tokens: 0,
      },
    ],
  },
  {
    id: 'snack-share',
    title: '零食盒里的最后一块饼干',
    text: '大家把最后一块饼干分成小份，顺便交换今天的趣事。',
    condition: { minDay: 2 },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '一起分享',
        text: '没人独占的饼干，吃起来好像格外香。',
        delta: { mood: 3, affection: 1, rapport: 1 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'wifi-fix',
    title: '寝室网络又通了',
    text: '计算机专业的室友发现只是插头松了，大家给这次维修起名“史诗重连”。',
    condition: { minDay: 2, majors: ['computing'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '史诗重连成功',
        text: '连接恢复了，寝室里的叹气也变成了笑声。',
        delta: { energy: 4, mood: 2, rapport: 2 },
        tokens: 3,
      },
    ],
  },
  {
    id: 'color-notes',
    title: '粉色便签的配色课',
    text: '艺术专业室友把便签贴成一张小色卡，普通书桌也像迷你展览。',
    condition: { minDay: 2, majors: ['art'] },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '收好灵感',
        text: '把今天的灵感记进成长手记。',
        delta: { mood: 4, affection: 1, progress: 1 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'balcony-stretch',
    title: '阳台伸展俱乐部',
    text: '体育专业室友发起轻松伸展，大家笑着把久坐的疲惫抖掉。',
    condition: { minDay: 2, majors: ['sport'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '轻松活动一下',
        text: '不用比赛，只是一起动一动。',
        delta: { stamina: 5, mood: 2 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'warm-reading',
    title: '台灯下的朗读时刻',
    text: '文科室友读了一段自己写的小短文，大家认真听完并送上鼓励。',
    condition: { minDay: 2, majors: ['literature'], minAffection: 35 },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '温柔回应',
        text: '被认真听见，是普通日子里的好事情。',
        delta: { affection: 3, energy: 2, rapport: 1 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'night-tea',
    title: '保温杯提醒员',
    text: '医学专业室友提议放下手机休息一会儿，大家给保温杯贴上了小花。',
    condition: { minDay: 2, majors: ['medicine'] },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '休息一小会儿',
        text: '这是一段普通的校园休息时间。',
        delta: { stamina: 4, energy: 3 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'humming-hour',
    title: '跑调也快乐的小合唱',
    text: '音乐专业室友起了个调，大家用完全不同的音高一起哼完。',
    condition: { minDay: 2, majors: ['music'] },
    scope: 'room',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '给快乐鼓掌',
        text: '没有评委，只有室友的笑声。',
        delta: { mood: 5, rapport: 1 },
        tokens: 3,
      },
    ],
  },
  {
    id: 'bathroom-mirror',
    title: '镜子边的云朵发型',
    text: '干湿分离的独卫里，室友对着干净镜子试了一个云朵发型，还给镜框贴了便签。',
    condition: { minDay: 2, bathrooms: ['private'], dryWet: true },
    scope: 'one',
    branch: false,
    outcomes: [
      {
        id: 'continue',
        label: '记下造型灵感',
        text: '云朵长卷发的灵感被收入衣柜。',
        delta: { mood: 4, rapport: 2 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'shared-bath-kit',
    title: '洗漱篮排队小剧场',
    text: '宿管提醒大家错峰使用楼层洗漱点。室友们提着洗漱篮，准备把等待变成日常小故事。',
    condition: { minDay: 2, bathrooms: ['shared', 'none'] },
    scope: 'room',
    branch: true,
    outcomes: [
      {
        id: 'chat',
        label: '一起排队聊天',
        text: '每位室友都讲了一个三句话以内的冷笑话。',
        cost: { energy: 2 },
        delta: { affection: 3, mood: 2, rapport: 2, progress: 1 },
        tokens: 3,
      },
      {
        id: 'later',
        label: '错峰出门，先休息',
        text: '大家约好稍晚出门，现在先各自休息。',
        delta: { energy: 3, mood: 1 },
        tokens: 1,
      },
    ],
  },
  {
    id: 'ribbon-studio',
    title: '缎带小舞台',
    text: '喜欢可爱风格的室友提议用便签和缎带布置一个想象中的小舞台，参加与否都由自己决定。',
    roleplayText:
      '在双方自愿开启的轻量角色扮演中，室友提议体验主人/男仆的小舞台，一切都可随时退出。',
    condition: { minDay: 2, tags: ['可爱', '男娘', '甜酷'] },
    scope: 'one',
    branch: true,
    outcomes: [
      {
        id: 'photo',
        label: '自愿尝试新造型',
        text: '只在想象里留下合照，奶油花边衬衫的灵感已收入衣柜。',
        cost: { energy: 2, tokens: 2 },
        delta: { affection: 2, mood: 4, rapport: 2, progress: 1 },
        tokens: 0,
      },
      {
        id: 'colors',
        label: '只一起挑选颜色',
        text: '没有表演也很好，大家一起挑了喜欢的配色。',
        delta: { affection: 2, mood: 2, rapport: 1 },
        tokens: 2,
      },
    ],
  },
  {
    id: 'common-room-plan',
    title: '周末寝室活动提案',
    text: '室友们把周末想做的事情写在小纸条上，等你一起决定。',
    condition: {
      minDay: 3,
      identities: ['leader', 'member', 'neighbor', 'custom'],
    },
    scope: 'room',
    branch: true,
    outcomes: [
      {
        id: 'jokes',
        label: '办一场冷笑话会',
        text: '奖品是大家真诚又困惑的笑声。',
        cost: { energy: 3 },
        delta: { mood: 5, rapport: 2, progress: 1 },
        tokens: 3,
      },
      {
        id: 'reading',
        label: '布置安静读书角',
        text: '把热闹留给下一次，这次享受安静陪伴。',
        delta: { energy: 3, affection: 1 },
        tokens: 1,
      },
    ],
  },
  {
    id: 'rainy-window',
    title: '雨天的窗边约定',
    text: '窗外下起一阵轻轻的雨，室友看着窗边空白的便签墙，想为今天留下点什么。',
    condition: {
      minDay: 4,
      dayModulo: { period: 2, remainder: 0 },
      minProgress: 3,
    },
    scope: 'room',
    branch: true,
    outcomes: [
      {
        id: 'decorate',
        label: '一起装饰便签窗',
        text: '星星和月亮贴在窗边，月光法师上衣的灵感也被收好。',
        cost: { energy: 1, tokens: 3 },
        delta: { mood: 4, rapport: 2, progress: 1 },
        tokens: 0,
      },
      {
        id: 'rest',
        label: '听雨休息',
        text: '暂时放下计划，安静恢复精神。',
        delta: { energy: 5, stamina: 2, mood: 2 },
        tokens: 2,
      },
    ],
  },
];
export function findEvent(id: string) {
  return CAMPUS_EVENTS.find((event) => event.id === id);
}
