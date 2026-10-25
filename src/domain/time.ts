import { GAME } from '../data/constants';
import type { GameState } from './model';
import { settleDay } from './rules';

export interface TimeResult {
  game: GameState;
  advanced: number;
  discarded: number;
  notice: string;
}

export function advanceTime(
  game: GameState,
  now: number,
  fast: boolean,
  visible: boolean,
): TimeResult {
  const result: TimeResult = { game, advanced: 0, discarded: 0, notice: '' };
  if (!visible || !Number.isSafeInteger(now) || now < 0) return result;
  const mode = fast ? 'fast' : 'normal';
  if (mode !== game.clock.mode)
    return {
      ...result,
      game: { ...game, clock: { anchor: now, lastObserved: now, mode } },
      notice: '计时模式已切换，自动计时从现在重新开始。',
    };
  if (now < game.clock.lastObserved)
    return {
      ...result,
      game: {
        ...game,
        clock: { ...game.clock, anchor: now, lastObserved: now },
      },
      notice: '检测到系统时间倒退，未补结算；已重建安全时间锚点。',
    };
  const interval = fast ? GAME.fastInterval : GAME.normalInterval;
  const elapsed = Math.floor((now - game.clock.anchor) / interval);
  const advanced = Math.min(elapsed, GAME.maxCatchUp);
  let next = game;
  for (let index = 0; index < advanced; index++)
    next = settleDay(next, next.day, 'auto');
  const anchor = game.clock.anchor + elapsed * interval;
  if (now !== game.clock.lastObserved || advanced)
    next = { ...next, clock: { anchor, lastObserved: now, mode } };
  return {
    game: next,
    advanced,
    discarded: elapsed - advanced,
    notice: advanced
      ? `自动补结算 ${advanced} 天${elapsed > advanced ? `；超过上限的 ${elapsed - advanced} 天已舍弃` : ''}，不足一个间隔的时间已保留。${next.pendingEvents.length ? `待选择 ${next.pendingEvents.length} 个分支，未替你作出选择。${next.pendingEvents.length >= GAME.maxPendingEvents ? '队列已满，暂停生成新的分支事件。' : ''}` : ''}`
      : '',
  };
}

export function nextDay(
  game: GameState,
  expectedDay: number,
  now: number,
  fast: boolean,
  visible: boolean,
): TimeResult {
  if (!visible || expectedDay !== game.day)
    return { game, advanced: 0, discarded: 0, notice: '' };
  const result = advanceTime(game, now, fast, visible);
  // If the automatic threshold wins at this boundary, it fulfils the same click.
  if (result.advanced) return result;
  const next = settleDay(result.game, expectedDay, 'manual');
  return {
    ...result,
    game: next,
    notice:
      result.notice ||
      `第 ${expectedDay} 天结算完成，欢迎来到第 ${next.day} 天。`,
  };
}
