import { findEvent } from '../data/events';
import { describe, expect, it } from 'vitest';
import { GAME } from '../data/constants';
import { createGame } from './initial';
import { advanceTime, nextDay } from './time';

const start = 100000;
const interval = GAME.normalInterval;
describe('persisted clock boundaries', () => {
  it('settles at exactly 2 hours, once, and preserves the remainder', () => {
    const game = createGame(start);
    expect(advanceTime(game, start + interval - 1, false, true).advanced).toBe(
      0,
    );
    const next = advanceTime(game, start + interval + 123, false, true);
    expect(next.advanced).toBe(1);
    expect(next.game.day).toBe(2);
    expect(next.game.clock.anchor).toBe(start + interval);
    expect(
      advanceTime(next.game, start + interval + 123, false, true).advanced,
    ).toBe(0);
    expect(
      advanceTime(next.game, start + 2 * interval, false, true).game.day,
    ).toBe(3);
  });
  it('does nothing while hidden; on return caps at seven and discards full overflow only', () => {
    const game = createGame(start);
    const now = start + 12 * interval + 777;
    expect(advanceTime(game, now, false, false).game).toBe(game);
    const next = advanceTime(game, now, false, true);
    expect(next.game.day).toBe(8);
    expect(next.advanced).toBe(7);
    expect(next.discarded).toBe(5);
    expect(next.notice).toContain('5 天已舍弃');
    expect(now - next.game.clock.anchor).toBe(777);
    expect(advanceTime(next.game, now, false, true).advanced).toBe(0);
    expect(next.game.pendingEvents.length).toBeLessThanOrEqual(
      GAME.maxPendingEvents,
    );
    expect(
      next.game.logs
        .filter((log) => log.type === 'event')
        .every((log) => !findEvent(log.eventId)!.branch),
    ).toBe(true);
  });
  it('keeps the anchor on manual advance and unifies simultaneous manual/auto work', () => {
    const game = createGame(start);
    const manual = nextDay(game, 1, start + interval - 1, false, true);
    expect(manual.game.day).toBe(2);
    expect(manual.game.clock.anchor).toBe(start);
    const boundary = nextDay(game, 1, start + interval, false, true);
    expect(boundary.game.day).toBe(2);
    expect(boundary.game.logs.filter((log) => log.type === 'day')).toHaveLength(
      1,
    );
    expect(
      boundary.game.logs.filter((log) => log.type === 'interaction'),
    ).toHaveLength(4);
    expect(boundary.game.logs).toHaveLength(5);
    expect(nextDay(boundary.game, 1, start + interval, false, true).game).toBe(
      boundary.game,
    );
    expect(
      advanceTime(boundary.game, start + interval, false, true).game.day,
    ).toBe(2);
    expect(nextDay(game, 1, start + interval, false, false).game).toBe(game);
  });
  it('detects rollback using last observed time even when newer than anchor', () => {
    const observed = advanceTime(
      createGame(start),
      start + 5000,
      false,
      true,
    ).game;
    const rollback = advanceTime(observed, start + 4000, false, true);
    expect(rollback.advanced).toBe(0);
    expect(rollback.notice).toContain('时间倒退');
    expect(rollback.game.clock.anchor).toBe(start + 4000);
    expect(rollback.game.day).toBe(1);
  });
  it('resets anchors when entering and leaving fast mode without mixing elapsed time', () => {
    const fast = advanceTime(
      createGame(start),
      start + interval * 2,
      true,
      true,
    );
    expect(fast.advanced).toBe(0);
    expect(fast.game.clock.mode).toBe('fast');
    const oneMinute = advanceTime(
      fast.game,
      fast.game.clock.anchor + GAME.fastInterval,
      true,
      true,
    );
    expect(oneMinute.game.day).toBe(2);
    const normal = advanceTime(
      oneMinute.game,
      oneMinute.game.clock.anchor + GAME.fastInterval * 3,
      false,
      true,
    );
    expect(normal.game.day).toBe(2);
    expect(normal.game.clock.mode).toBe('normal');
    expect(
      advanceTime(
        normal.game,
        normal.game.clock.anchor + interval - 1,
        false,
        true,
      ).advanced,
    ).toBe(0);
  });
});
