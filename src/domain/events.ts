import { z } from 'zod';
import { ACTIVITY, GAME } from '../data/constants';
import {
  CAMPUS_EVENTS,
  findEvent,
  type CampusEvent,
  type EventCondition,
  type EventOutcome,
} from '../data/events';
import { gameSchema, type Character, type GameState, type Room } from './model';
import { nextRandom } from './random';
import { applyEffects, adjustTokens, costError } from './effects';
import { addLog } from './log';
import { syncProgress } from './progress';
import { canInteract } from './interactions';
import { MAJORS } from '../data/rules';
import { IDENTITIES } from '../data/identities';
import { clamp } from './stats';
import { onLeave } from './conditions';

export type PendingEvent = GameState['pendingEvents'][number];
export function eventConditionText(condition: EventCondition): string {
  const notes = [`游戏日 ≥ ${condition.minDay}`];
  if (condition.dayModulo)
    notes.push(
      condition.dayModulo.period === 2 && condition.dayModulo.remainder === 0
        ? '偶数游戏日'
        : `每 ${condition.dayModulo.period} 天的指定日`,
    );
  if (condition.bathrooms)
    notes.push(
      condition.bathrooms
        .map((type) =>
          type === 'private'
            ? '独卫'
            : type === 'shared'
              ? '公共卫浴'
              : '无洗手间',
        )
        .join(' / '),
    );
  if (condition.dryWet) notes.push('干湿分离');
  if (condition.majors)
    notes.push(
      `${condition.majors.map((major) => MAJORS[major].label).join(' / ')}室友在场`,
    );
  if (condition.minAffection) notes.push(`好感 ≥ ${condition.minAffection}`);
  if (condition.minProgress) notes.push(`男娘进度 ≥ ${condition.minProgress}`);
  if (condition.identities)
    notes.push(
      `玩家身份：${condition.identities.map((identity) => IDENTITIES[identity].name).join(' / ')}`,
    );
  if (condition.tags) notes.push(`标签包含 ${condition.tags.join(' / ')}`);
  return notes.join(' · ');
}
export function eligibleEventResidents(
  game: GameState,
  room: Room,
  event: CampusEvent,
  day: number,
): Character[] {
  const condition = event.condition;
  if (
    day < Math.max(ACTIVITY.firstEventDay, condition.minDay) ||
    (condition.dayModulo &&
      day % condition.dayModulo.period !== condition.dayModulo.remainder) ||
    (condition.bathrooms &&
      !condition.bathrooms.includes(room.facilities.bathroom)) ||
    (condition.dryWet !== undefined &&
      condition.dryWet !== room.facilities.dryWet) ||
    (condition.identities &&
      !condition.identities.includes(game.player.identity))
  )
    return [];
  return game.characters.filter(
    (character) =>
      character.roomId === room.id &&
      !onLeave(character, day) &&
      character.age >= 18 &&
      (!condition.majors || condition.majors.includes(character.major)) &&
      character.stats.affection >= (condition.minAffection ?? 0) &&
      character.stats.progress >= (condition.minProgress ?? 0) &&
      (!condition.tags ||
        condition.tags.some((tag) => character.tags.includes(tag))),
  );
}
export function eventChoiceError(
  game: GameState,
  pending: PendingEvent,
  outcome: EventOutcome,
): string | undefined {
  if (!canInteract(game)) return '当前视角只可观察，可切换身份后选择。';
  return costError(game, pending.characterIds, outcome.cost);
}
function settleEvent(
  game: GameState,
  pending: PendingEvent,
  outcome: EventOutcome,
): GameState {
  if (game.resolvedEventIds.includes(pending.id)) return game;
  const affected = applyEffects(
    game,
    pending.characterIds,
    outcome.delta,
    'event',
    outcome.cost,
  );
  const currency = adjustTokens(
    affected.game,
    outcome.tokens - (outcome.cost?.tokens ?? 0),
  );
  const token = `event:${pending.eventId}:${outcome.id}`;
  const room = game.rooms.find((candidate) => candidate.id === pending.roomId)!;
  const habitability = clamp(
    room.habitability + (outcome.habitability ?? 0),
    0,
    100,
  );
  const next = {
    ...currency.game,
    rooms: currency.game.rooms.map((candidate) =>
      candidate.id === room.id ? { ...candidate, habitability } : candidate,
    ),
    pendingEvents: currency.game.pendingEvents.filter(
      (event) => event.id !== pending.id,
    ),
    resolvedEventIds: [
      ...currency.game.resolvedEventIds,
      pending.id,
      ...(!currency.game.resolvedEventIds.includes(token) ? [token] : []),
    ],
  };
  return syncProgress(
    addLog(next, {
      id: `result:${pending.id}`,
      type: 'event',
      day: game.day,
      triggerDay: pending.day,
      instanceId: pending.id,
      eventId: pending.eventId,
      roomId: pending.roomId,
      characterIds: pending.characterIds,
      choiceId: outcome.id,
      results: affected.results,
      tokenDelta: currency.actual,
      ...(outcome.habitability
        ? { habitabilityDelta: habitability - room.habitability }
        : {}),
    }),
  );
}
export function scheduleRoomEvents(game: GameState, day: number): GameState {
  if (game.setup !== 'done' || day !== game.day) return game;
  let next = game;
  for (const [index, room] of game.rooms.entries()) {
    const existing = next.eventProgress.find(
      (progress) => progress.roomId === room.id,
    );
    if (existing && existing.checkedThrough >= day) continue;
    let progress = existing ?? {
      roomId: room.id,
      checkedThrough: 0,
      seenEventIds: [] as string[],
    };
    const queueFull = next.pendingEvents.length >= GAME.maxPendingEvents;
    const candidates = CAMPUS_EVENTS.filter(
      (event) =>
        !progress.seenEventIds.includes(event.id) &&
        !(event.branch && queueFull) &&
        eligibleEventResidents(next, room, event, day).length > 0,
    );
    progress = { ...progress, checkedThrough: day };
    next = {
      ...next,
      eventProgress: [
        ...next.eventProgress.filter((entry) => entry.roomId !== room.id),
        progress,
      ],
    };
    if (!candidates.length) continue;
    let seed = nextRandom(next.randomSeed);
    const music = next.characters.some(
      (character) =>
        character.roomId === room.id && character.major === 'music',
    );
    const chance =
      ACTIVITY.eventChance * (music ? ACTIVITY.musicEventMultiplier : 1);
    next = { ...next, randomSeed: seed };
    if (seed / 0x100000000 >= chance) continue;
    seed = nextRandom(seed);
    const event = candidates[seed % candidates.length]!;
    const residents = eligibleEventResidents(next, room, event, day);
    seed = nextRandom(seed);
    const lead = residents[seed % residents.length]!;
    const characterIds =
      event.scope === 'room'
        ? [
            lead.id,
            ...next.characters
              .filter(
                (character) =>
                  character.roomId === room.id &&
                  character.id !== lead.id &&
                  !onLeave(character, day),
              )
              .map((character) => character.id),
          ]
        : [lead.id];
    const pending: PendingEvent = {
      id: `evt-${day}-${index}-${seed.toString(36)}`,
      eventId: event.id,
      roomId: room.id,
      day,
      characterIds,
    };
    next = {
      ...next,
      randomSeed: seed,
      eventProgress: next.eventProgress.map((entry) =>
        entry.roomId === room.id
          ? { ...entry, seenEventIds: [...entry.seenEventIds, event.id] }
          : entry,
      ),
    };
    if (event.branch)
      next = { ...next, pendingEvents: [...next.pendingEvents, pending] };
    else next = settleEvent(next, pending, event.outcomes[0]!);
  }
  return next;
}
const choiceCommandSchema = z.strictObject({
  instanceId: z.string().min(1).max(80),
  choiceId: z.string().min(1).max(80),
});
export type EventChoiceCommand = z.infer<typeof choiceCommandSchema>;
export function chooseEvent(
  game: GameState,
  input: unknown,
): { game: GameState; error?: string } {
  const fail = (error: string) => ({ game, error });
  const result = choiceCommandSchema.safeParse(input);
  if (!result.success) return fail('事件选择参数无效。');
  if (game.resolvedEventIds.includes(result.data.instanceId))
    return fail('这个事件已结算，不能重复领奖。');
  const pending = game.pendingEvents.find(
    (event) => event.id === result.data.instanceId,
  );
  if (!pending) return fail('待选事件不存在，可能已处理或参与室友已离开。');
  const outcome = findEvent(pending.eventId)?.outcomes.find(
    (choice) => choice.id === result.data.choiceId,
  );
  if (!outcome) return fail('该分支选项不存在。');
  const error = eventChoiceError(game, pending, outcome);
  if (error) return fail(error);
  const next = gameSchema.safeParse(settleEvent(game, pending, outcome));
  return next.success
    ? { game: next.data }
    : fail('事件结算未通过完整性校验，原有存档保持不变。');
}
