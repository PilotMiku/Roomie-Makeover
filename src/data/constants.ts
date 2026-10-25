export const PROJECT_NAME = 'Roomie-Makeover';
export const APP_NAME = '室友大改造';
export const SETTINGS_KEY = 'roomdev:preferences:1.0';
export const PREFERENCES_VERSION = '1.0' as const;

export const SAVES = {
  slots: ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'],
  maxImportBytes: 2 * 1024 * 1024,
  compactStorageBytes: 1024 * 1024,
  selectionKey: 'roomdev:active-slot',
  lockKey: 'roomdev:slot:1',
} as const;

export const GAME = {
  version: '1.6',
  tagInitialProgress: 50,
  leaveDays: 7,
  leaveRecovery: { stamina: 12, energy: 10, mood: 6 },
  exhaustionMoodLoss: 5,
  exhaustionRapportLoss: 2,
  maxPortraits: 1000,
  maxMetaEntries: 1000,
  defaultAge: 20,
  storageKey: 'roomdev:slot:1',
  maxCharacters: 24,
  maxRooms: 6,
  maxLogs: 300,
  maxPendingEvents: 3,
  statMin: 0,
  statMax: 100,
  dailyProgress: 3,
  naturalLimit: 15,
  completeProgress: 100,
  dressProgress: 50,
  defaultHabitability: 60,
  completeDays: 30,
  normalInterval: 2 * 60 * 60 * 1000,
  fastInterval: 60 * 1000,
  checkInterval: 15 * 1000,
  maxCatchUp: 7,
  multiplierMin: 0.8,
  multiplierMax: 1.3,
} as const;

export const STAT_LABELS = {
  affection: '好感',
  mood: '心情',
  stamina: '体力',
  energy: '精力',
  progress: '男娘进度',
  rapport: '默契值',
} as const;

export const MILESTONES = [
  {
    id: 'M0',
    title: '搬入之前',
    description: '工程、页面导航与部署基线',
    state: '已完成',
  },
  {
    id: 'M1',
    title: '小屋有了室友',
    description: '单寝室、床位移动、六维与日结算',
    state: '已完成',
  },
  {
    id: 'M2',
    title: '认识新的你',
    description: '身份选择、寝室与角色创建',
    state: '已完成',
  },
  {
    id: 'M3',
    title: '今天穿什么',
    description: '三槽换装、配色与收藏套装',
    state: '已完成',
  },
  {
    id: 'M4',
    title: '日常有点小惊喜',
    description: '互动、礼物与有选择的随机事件',
    state: '已完成',
  },
  {
    id: 'M5',
    title: '把回忆收好',
    description: '五个存档槽、备份与安全迁移',
    state: '已完成',
  },
  {
    id: 'M6',
    title: '隔壁也很热闹',
    description: '多寝室与至多 24 名常住室友',
    state: '已完成',
  },
  {
    id: 'M7',
    title: '每一天，都值得收藏',
    description: '成就、新周目与离线体验',
    state: '已完成',
  },
] as const;

export const ACTIVITY = {
  autoInteractionPrefix: 'auto-interaction:',
  interactionsPerDay: 3,
  giftsPerDay: 1,
  startingTokens: 20,
  dailyTokens: 8,
  maxTokens: 9999,
  firstEventDay: 2,
  eventChance: 0.78,
  musicEventMultiplier: 1.2,
} as const;
