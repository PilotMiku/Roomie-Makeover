import { z } from 'zod';
import { findIdentityAction } from '../data/identityActions';
import { applyEffects, costError, adjustTokens } from './effects';
import { gameSchema, playerSchema, type GameState } from './model';
import { addLog } from './log';
import { syncProgress } from './progress';
import { clamp } from './stats';
import { onLeave } from './conditions';

const commandSchema = z.strictObject({
  operationId: z.string().min(1).max(80),
  expectedDay: z.number().int().min(1),
  identity: playerSchema.shape.identity,
  roomId: z.string().min(1).max(80),
  actionId: z.string().min(1).max(80),
});
export type IdentityCommand = z.infer<typeof commandSchema>;
export function identityActionError(
  game: GameState,
  roomId: string,
  actionId: string,
): string | undefined {
  const action = findIdentityAction(actionId);
  if (
    game.setup !== 'done' ||
    !action ||
    !action.identities.includes(game.player.identity)
  )
    return '当前身份不能发起这个行动。';
  if (!game.rooms.some((room) => room.id === roomId)) return '目标寝室不存在。';
  if (game.identityActions.roomIds.includes(roomId))
    return '这间寝室今天已完成身份行动，明天再来吧。';
  const residents = game.characters.filter(
    (character) => character.roomId === roomId && !onLeave(character, game.day),
  );
  if (!residents.length)
    return '这间寝室没有可参与的室友（空房或全员休养），暂不能发起集体行动。';
  return costError(
    game,
    residents.map((character) => character.id),
    action.cost,
  );
}
export function performIdentityAction(
  game: GameState,
  input: unknown,
): { game: GameState; error?: string } {
  const fail = (error: string) => ({ game, error });
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return fail('身份行动参数无效。');
  const command = parsed.data;
  if (
    command.identity !== game.player.identity ||
    command.expectedDay !== game.day
  )
    return fail('身份或游戏日已变化，请重新发起。');
  if (
    game.logs.some((log) => log.id === command.operationId) ||
    game.identityActions.operationIds.includes(command.operationId)
  )
    return fail('这个行动已经结算。');
  const error = identityActionError(game, command.roomId, command.actionId);
  if (error) return fail(error);
  const action = findIdentityAction(command.actionId)!;
  const ids = game.characters
    .filter(
      (character) =>
        character.roomId === command.roomId && !onLeave(character, game.day),
    )
    .map((character) => character.id);
  const affected = applyEffects(
    game,
    ids,
    action.delta,
    'interaction',
    action.cost,
  );
  const old = game.rooms.find((room) => room.id === command.roomId)!;
  const habitability = clamp(old.habitability + action.habitability, 0, 100);
  const next = syncProgress(
    addLog(
      {
        ...adjustTokens(affected.game, -(action.cost.tokens ?? 0)).game,
        characters: affected.game.characters.map((character) =>
          ids.includes(character.id)
            ? {
                ...character,
                daily: { ...character.daily, identityParticipated: true },
              }
            : character,
        ),
        rooms: affected.game.rooms.map((room) =>
          room.id === old.id ? { ...room, habitability } : room,
        ),
        identityActions: {
          day: game.day,
          roomIds: [...game.identityActions.roomIds, old.id],
          operationIds: [
            ...game.identityActions.operationIds,
            command.operationId,
          ],
        },
      },
      {
        id: command.operationId,
        type: 'identity',
        day: game.day,
        roomId: old.id,
        actionId: action.id,
        identity: game.player.identity,
        results: affected.results,
        habitabilityDelta: habitability - old.habitability,
        cost: {
          energy: action.cost.energy ?? 0,
          stamina: action.cost.stamina ?? 0,
          tokens: action.cost.tokens ?? 0,
        },
      },
    ),
  );
  const checked = gameSchema.safeParse(next);
  return checked.success
    ? { game: checked.data }
    : fail('身份行动校验失败，原有状态保持不变。');
}
