import { changeStats, clamp, statKeys } from './stats';
export { changeStats, clamp, statKeys } from './stats';
import { ACTIVITY, GAME } from '../data/constants';
import { BASE_NATURAL, DRY_WET_DELTA, FACILITIES, MAJORS } from '../data/rules';
import { createBeds } from './initial';
import { canManage, statLabel } from './presentation';
import { syncProgress } from './progress';
import { addLog } from './log';
import { findClothing } from '../data/clothes';
import { emptyDaily } from './activityState';
import { scheduleRoomEvents } from './events';
import { adjustTokens } from './effects';
import { renderActivityLog } from './activityText';
import { settleIdleInteractions } from './interactions';
import { findIdentityAction } from '../data/identityActions';
import { IDENTITIES } from '../data/identities';
import { onLeave, resolveConditions } from './conditions';
import { costText, deltaText } from './activityText';
export { isComplete } from './completion';
export { addLog } from './log';
import type {
  BedType,
  Character,
  GameLog,
  GameState,
  Room,
  Stats,
} from './model';

export function naturalDelta(character: Character, room: Room): Stats {
  const delta = { ...BASE_NATURAL };
  for (const key of statKeys) {
    const multiplier = clamp(
      MAJORS[character.major].multipliers[key] ?? 1,
      GAME.multiplierMin,
      GAME.multiplierMax,
    );
    const facility =
      (FACILITIES[room.facilities.bathroom].delta[key] ?? 0) +
      (room.facilities.dryWet ? (DRY_WET_DELTA[key] ?? 0) : 0);
    const comfort =
      room.habitability >= 80 && (key === 'mood' || key === 'stamina')
        ? 1
        : room.habitability < 30 && key === 'mood'
          ? -1
          : 0;
    delta[key] = clamp(
      Math.round(BASE_NATURAL[key] * multiplier) + facility + comfort,
      -GAME.naturalLimit,
      GAME.naturalLimit,
    );
  }
  return delta;
}

// The caller supplies the day it observed: stale or repeated commands become no-ops.
export function settleDay(
  game: GameState,
  expectedDay: number,
  source: 'manual' | 'auto',
): GameState {
  if (
    game.day !== expectedDay ||
    game.lastSettledDay >= expectedDay ||
    game.day >= Number.MAX_SAFE_INTEGER
  )
    return game;
  const results: Extract<GameLog, { type: 'day' }>['results'] = [];
  const prepared = resolveConditions(game);
  const characters = prepared.characters.map((character) => {
    const room = game.rooms.find(
      (candidate) => candidate.id === character.roomId,
    );
    if (!room) throw new Error('角色寝室引用无效');
    const updated = changeStats(
      character,
      onLeave(character, game.day)
        ? GAME.leaveRecovery
        : naturalDelta(character, room),
      game.day,
    );
    const delta = { ...updated.stats };
    for (const key of statKeys) delta[key] -= character.stats[key];
    results.push({
      characterId: character.id,
      delta,
      major: character.major,
      bathroom: room.facilities.bathroom,
      dryWet: room.facilities.dryWet,
      activity: character.daily.changes,
    });
    return {
      ...updated,
      growth: [
        ...updated.growth,
        { day: game.day, delta, source: 'natural' as const },
      ].slice(-GAME.maxLogs),
    };
  });
  const withInteractions = settleIdleInteractions(
    resolveConditions({ ...prepared, characters }),
  );
  const withEvents = scheduleRoomEvents(withInteractions, game.day);
  const allowance = adjustTokens(withEvents, ACTIVITY.dailyTokens);
  const finalResults = results.map((result) => ({
    ...result,
    activity: allowance.game.characters.find(
      (character) => character.id === result.characterId,
    )!.daily.changes,
  }));
  const settledCharacters = allowance.game.characters.map((character) => ({
    ...character,
    settledDays: character.settledDays + 1,
    daily: emptyDaily(game.day + 1),
  }));
  return addLog(
    syncProgress({
      ...allowance.game,
      characters: settledCharacters,
      day: game.day + 1,
      lastSettledDay: game.day,
      identityActions: { day: game.day + 1, roomIds: [], operationIds: [] },
    }),
    {
      id: `day-${game.day}`,
      type: 'day',
      day: game.day,
      source,
      allowance: allowance.actual,
      results: finalResults,
    },
  );
}

export function moveCharacter(
  game: GameState,
  characterId: string,
  targetBedId: string,
): GameState {
  if (!canManage(game, 'residents')) return game;
  const character = game.characters.find(
    (candidate) => candidate.id === characterId,
  );
  const room = game.rooms.find((candidate) =>
    candidate.beds.some((bed) => bed.id === targetBedId),
  );
  if (
    !character ||
    !room ||
    character.bedId === targetBedId ||
    character.roomId !== room.id
  )
    return game;
  const occupant = game.characters.find(
    (candidate) => candidate.bedId === targetBedId,
  );
  const characters = game.characters.map((candidate) => {
    if (candidate.id === characterId)
      return { ...candidate, bedId: targetBedId };
    if (candidate.id === occupant?.id)
      return { ...candidate, bedId: character.bedId };
    return candidate;
  });
  return addLog(
    { ...game, characters },
    {
      id: crypto.randomUUID(),
      type: 'move',
      day: game.day,
      characterId,
      from: character.bedId,
      to: targetBedId,
      swappedId: occupant?.id ?? null,
    },
  );
}

export function changeBedType(
  game: GameState,
  roomId: string,
  bedType: BedType,
): GameState {
  if (!canManage(game, 'room')) return game;
  const room = game.rooms.find((candidate) => candidate.id === roomId);
  if (!room || room.bedType === bedType) return game;
  return addLog(
    {
      ...game,
      rooms: game.rooms.map((candidate) =>
        candidate.id === roomId
          ? {
              ...candidate,
              bedType,
              beds: createBeds(roomId, room.capacity, bedType).map(
                (bed, index) => ({ ...bed, id: room.beds[index]!.id }),
              ),
            }
          : candidate,
      ),
    },
    {
      id: crypto.randomUUID(),
      type: 'layout',
      day: game.day,
      roomId,
      bedType,
    },
  );
}

export function bedLabel(game: GameState, bedId: string) {
  const bed = game.rooms
    .flatMap((room) => room.beds)
    .find((candidate) => candidate.id === bedId);
  if (!bed) return '旧床位';
  return `${bed.unit} 号${bed.level === 'loft' ? '床' : bed.level === 'upper' ? '上铺' : '下铺'}`;
}

export function renderLog(game: GameState, log: GameLog): string {
  if (log.type === 'condition') {
    const name =
      game.characters.find((row) => row.id === log.characterId)?.name ??
      '已离开的室友';
    const text =
      log.reason === 'stamina'
        ? '体力归零，请假休养 7 个游戏日，第 ' +
          log.leaveUntilDay +
          ' 天返寝；休养期间暂停互动、事件参与和男娘成长。'
        : log.reason === 'mood'
          ? '心情归零，好感与男娘进度减半（向下取整）；低于穿戴门槛的妆造自动收起，已解锁收藏保留。'
          : '精力归零，心情 -5、默契 -2，请留意休息。';
    return (
      name +
      ' · 状态后果：' +
      text +
      ' 实际变化：' +
      deltaText(game, log.characterId, log.delta)
    );
  }
  if (log.type === 'identity') {
    const action = findIdentityAction(log.actionId);
    const room = game.rooms.find((candidate) => candidate.id === log.roomId);
    return (
      (IDENTITIES[log.identity as GameState['player']['identity']]?.name ??
        '玩家') +
      ' · ' +
      (action?.name ?? '身份行动') +
      ' · ' +
      (room?.name ?? '原寝室') +
      '：' +
      (action?.text ?? '') +
      ' 宜居度 ' +
      (log.habitabilityDelta >= 0 ? '+' : '') +
      log.habitabilityDelta +
      '。每位参与者消耗：' +
      costText({ energy: log.cost.energy, stamina: log.cost.stamina }) +
      '；全寝室心意点消耗 ' +
      log.cost.tokens +
      '。' +
      log.results
        .map(
          (result) =>
            (game.characters.find(
              (character) => character.id === result.characterId,
            )?.name ?? '已离开的室友') +
            '：' +
            deltaText(game, result.characterId, result.delta),
        )
        .join('；')
    );
  }
  if (log.type === 'interaction' || log.type === 'event')
    return renderActivityLog(game, log);
  const name = (id: string) =>
    game.characters.find((character) => character.id === id)?.name ??
    '已离开的室友';
  if (log.type === 'wardrobe') {
    if (log.action === 'unlock')
      return `衣柜上新：${log.itemIds.map((id) => findClothing(id)?.name ?? id).join('、')}。`;
    if (log.action === 'preset-save')
      return `已收藏套装「${log.presetName}」。`;
    if (log.action === 'preset-delete')
      return `已删除套装「${log.presetName}」。`;
    return `${log.characterId ? name(log.characterId) : '室友'}${log.action === 'color' ? '更新了穿搭配色' : log.action === 'random' ? '换上了随机搭配' : log.action === 'preset-apply' ? `应用了套装「${log.presetName}」` : '换上了新的服装'}。`;
  }
  if (log.type === 'day')
    return `第 ${log.day} 天已结算 · ${log.source === 'auto' ? '自动' : '手动'} · ${log.results.length} 位室友的校园日常 · ${log.results
      .map(
        (result) =>
          `${name(result.characterId)} ${statLabel(
            game,
            game.characters.find(
              (character) => character.id === result.characterId,
            ),
            'rapport',
          )} ${result.delta.rapport >= 0 ? '+' : ''}${result.delta.rapport}`,
      )
      .join(' / ')}`;
  if (log.type === 'customize') {
    if (log.action === 'character')
      return `${name(log.entityId)}的室友档案已保存。`;
    if (log.action === 'delete') return '一位室友已离开寝室，床位已释放。';
    if (log.action === 'player') return '玩家身份已更新，室友与成长进度保留。';
    if (log.action === 'room')
      return '寝室配置已更新，所有室友床位已安全保留。';
    if (log.action === 'welcome')
      return '入住完成！属于大家的改造日记从这里开始。';
    return '相处方式已更新，历史手记遵循当前的自愿设置。';
  }
  if (log.type === 'layout')
    return `床型调整为${log.bedType === 'loft' ? '上床下桌' : '双层床'}，室友与床位绑定保留。`;
  const fromRoom = game.rooms.find((room) =>
    room.beds.some((bed) => bed.id === log.from),
  );
  const toRoom = game.rooms.find((room) =>
    room.beds.some((bed) => bed.id === log.to),
  );
  return `${name(log.characterId)}${fromRoom && toRoom && fromRoom.id !== toRoom.id ? `从「${fromRoom.name}」搬到「${toRoom.name}」，` : ' '}移至 ${bedLabel(game, log.to)}${log.swappedId ? `，与${name(log.swappedId)}交换` : ''}。`;
}
