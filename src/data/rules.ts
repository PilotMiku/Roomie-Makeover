import type { Stats, Character, Room } from '../domain/model';

export const MAJORS: Record<
  Character['major'],
  { label: string; multipliers: Partial<Stats> }
> = {
  daily: { label: '日常 / 无专业', multipliers: {} },
  computing: {
    label: '计算机 / 软件',
    multipliers: { progress: 1.3, energy: 0.8 },
  },
  art: { label: '艺术 / 设计', multipliers: { mood: 1.3 } },
  sport: { label: '体育', multipliers: { stamina: 1.3, progress: 0.8 } },
  literature: { label: '文科', multipliers: { affection: 1.3 } },
  medicine: { label: '医学', multipliers: { stamina: 1.2, energy: 0.8 } },
  music: { label: '音乐 / 表演', multipliers: { mood: 1.2 } },
  custom: { label: '自定义专业', multipliers: {} },
};

export const BASE_NATURAL: Stats = {
  affection: 2,
  mood: 3,
  stamina: 4,
  energy: -4,
  progress: 3,
  rapport: 2,
};
export const FACILITIES: Record<
  Room['facilities']['bathroom'],
  { label: string; delta: Partial<Stats> }
> = {
  private: { label: '独卫', delta: { mood: 1, stamina: 1 } },
  shared: { label: '公共卫浴', delta: {} },
  none: { label: '无洗手间', delta: { mood: -2, stamina: -1 } },
};
export const DRY_WET_DELTA: Partial<Stats> = { mood: 1 };
