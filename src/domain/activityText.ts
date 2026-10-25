import { GIFTS, INTERACTIONS, type ActivityCost } from '../data/interactions';
import { findEvent } from '../data/events';
import { MAJORS } from '../data/rules';
import type { GameLog, GameState, Stats } from './model';
import { statKeys } from './stats';
import { roleplayEnabled, statLabel } from './presentation';
import { ACTIVITY } from '../data/constants';

export function costText(cost: ActivityCost = {}): string {
  return (
    [
      cost.energy ? `精力 ${cost.energy}` : '',
      cost.stamina ? `体力 ${cost.stamina}` : '',
      cost.tokens ? `心意点 ${cost.tokens}` : '',
    ]
      .filter(Boolean)
      .join('、') || '无额外消耗'
  );
}
export function deltaText(
  game: GameState,
  characterId: string,
  delta: Partial<Stats>,
): string {
  const character = game.characters.find(
    (candidate) => candidate.id === characterId,
  );
  return (
    statKeys
      .filter((key) => delta[key])
      .map(
        (key) =>
          `${statLabel(game, character, key)} ${(delta[key] ?? 0) > 0 ? '+' : ''}${delta[key]}`,
      )
      .join(' · ') || '数值已达边界，无额外增减'
  );
}
export function eventNarrative(
  game: GameState,
  eventId: string,
  leadId: string,
): string {
  const event = findEvent(eventId);
  const lead = game.characters.find((character) => character.id === leadId);
  return event
    ? lead && roleplayEnabled(game, lead) && event.roleplayText
      ? event.roleplayText
      : event.text
    : '这是一段已经记下的校园日常。';
}
export function renderActivityLog(
  game: GameState,
  log: Extract<GameLog, { type: 'interaction' | 'event' }>,
): string {
  const name = (id: string) =>
    game.characters.find((character) => character.id === id)?.name ??
    '已离开的室友';
  if (log.type === 'interaction') {
    const character = game.characters.find(
      (candidate) => candidate.id === log.characterId,
    );
    const gift = GIFTS.find((item) => item.id === log.giftId);
    const action = INTERACTIONS.find((item) => item.id === log.actionId);
    const automatic = log.id.startsWith(ACTIVITY.autoInteractionPrefix);
    const active = !automatic && character && roleplayEnabled(game, character);
    const label =
      gift?.name ??
      (active ? (action?.roleplayName ?? action?.name) : action?.name) ??
      '日常互动';
    const text =
      gift?.text ??
      (active ? (action?.roleplayText ?? action?.text) : action?.text) ??
      '';
    return `${name(log.characterId)} · ${automatic ? '自动日常 · ' : ''}${label}：${text} 实际变化：${deltaText(game, log.characterId, log.delta)}。消耗：${costText(log.cost)}；正向增益按${MAJORS[log.major].label}专业倍率计算并受合法边界限制。`;
  }
  const event = findEvent(log.eventId);
  const outcome = event?.outcomes.find((choice) => choice.id === log.choiceId);
  const room = game.rooms.find((candidate) => candidate.id === log.roomId);
  return `${game.rooms.length > 1 && room ? `「${room.name}」的` : ''}事件「${event?.title ?? '校园小事'}」${outcome ? ` · ${outcome.label}` : ''}：${eventNarrative(game, log.eventId, log.characterIds[0]!)} ${outcome?.text ?? ''} ${log.results.map((result) => `${name(result.characterId)}：${deltaText(game, result.characterId, result.delta)}`).join('；')}。${log.habitabilityDelta ? `宜居度 ${log.habitabilityDelta > 0 ? '+' : ''}${log.habitabilityDelta}。` : ''}心意点 ${log.tokenDelta >= 0 ? '+' : ''}${log.tokenDelta}。`;
}
