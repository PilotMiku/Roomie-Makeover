import { z } from 'zod';
import { ACTIVITY } from '../data/constants';
import {
  GIFT_IDS,
  GIFTS,
  INTERACTION_IDS,
  INTERACTIONS,
  type GiftId,
  type InteractionId,
} from '../data/interactions';
import { gameSchema, type Character, type GameState } from './model';
import { roleplayEnabled } from './presentation';
import { applyEffects, costError, adjustTokens } from './effects';
import { addLog } from './log';
import { syncProgress } from './progress';
import { nextRandom } from './random';

const identifier = z.string().min(1).max(80);
const commandSchema = z.strictObject({
  operationId: identifier,
  expectedDay: z.number().int().min(1),
  characterId: identifier,
  kind: z.enum(['normal', 'gift']),
  actionId: z.enum(INTERACTION_IDS).optional(),
  giftId: z.enum(GIFT_IDS).optional(),
});
export type InteractionCommand = z.infer<typeof commandSchema>;
export function canInteract(game: GameState) {
  return game.setup === 'done' && game.player.identity !== 'observer';
}
export function interactionOffer(
  game: GameState,
  character: Character,
  kind: 'normal' | 'gift',
  id: InteractionId | GiftId,
) {
  const definition =
    kind === 'gift'
      ? GIFTS.find((gift) => gift.id === id)
      : INTERACTIONS.find((action) => action.id === id);
  if (!definition) return { error: '互动不存在。' };
  let error: string | undefined;
  if (!canInteract(game)) error = '当前视角只可观察，请先完成入住或切换身份。';
  else if (
    kind === 'normal' &&
    character.daily.interactions >= ACTIVITY.interactionsPerDay
  )
    error = '这位室友今天已完成 3 次普通互动。';
  else if (kind === 'gift' && character.daily.gifts >= ACTIVITY.giftsPerDay)
    error = '这位室友今天已收到 1 次礼物。';
  else if (
    'consentRequired' in definition &&
    definition.consentRequired &&
    !roleplayEnabled(game, character)
  )
    error = '需要全局与该室友两层自愿许可，且当前身份允许，才能参与扮演。';
  else error = costError(game, [character.id], definition.cost);
  const active = roleplayEnabled(game, character);
  const name =
    active && 'roleplayName' in definition && definition.roleplayName
      ? definition.roleplayName
      : definition.name;
  return { definition, name, error };
}
export function interact(
  game: GameState,
  input: unknown,
): { game: GameState; error?: string } {
  const fail = (error: string) => ({ game, error });
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return fail('互动参数无效。');
  const command = parsed.data;
  if (command.operationId.startsWith(ACTIVITY.autoInteractionPrefix))
    return fail('该回执编号保留给室友自动日常。');
  if (command.expectedDay !== game.day)
    return fail('游戏日已变化，请重新点击本日互动。');
  if (
    game.characters.some((character) =>
      character.daily.operationIds.includes(command.operationId),
    )
  )
    return fail('这次互动已经结算，请勿重复提交。');
  const character = game.characters.find(
    (candidate) => candidate.id === command.characterId,
  );
  if (!character) return fail('请选择存在的常住室友。');
  const selectedId =
    command.kind === 'gift' ? command.giftId : command.actionId;
  if (
    !selectedId ||
    (command.kind === 'gift'
      ? command.actionId !== undefined
      : command.giftId !== undefined)
  )
    return fail('请选择对应的互动或礼物。');
  const offer = interactionOffer(game, character, command.kind, selectedId);
  if (offer.error || !offer.definition)
    return fail(offer.error ?? '互动不存在。');
  const next = commitInteraction(game, command, character, offer.definition);
  const validated = gameSchema.safeParse(syncProgress(next));
  return validated.success
    ? { game: validated.data }
    : fail('互动未通过完整性校验，已保留原有状态。');
}

// Both manual and autonomous choices use the same costs, limits and effect ledger.
function commitInteraction(
  game: GameState,
  command: InteractionCommand,
  character: Character,
  definition: (typeof INTERACTIONS)[number] | (typeof GIFTS)[number],
): GameState {
  const affected = applyEffects(
    game,
    [character.id],
    definition.delta,
    'interaction',
    definition.cost,
  );
  let next = adjustTokens(affected.game, -(definition.cost.tokens ?? 0)).game;
  next = {
    ...next,
    characters: next.characters.map((candidate) =>
      candidate.id === character.id
        ? {
            ...candidate,
            daily: {
              ...candidate.daily,
              interactions:
                candidate.daily.interactions +
                (command.kind === 'normal' ? 1 : 0),
              gifts: candidate.daily.gifts + (command.kind === 'gift' ? 1 : 0),
              operationIds: [
                ...candidate.daily.operationIds,
                command.operationId,
              ],
            },
          }
        : candidate,
    ),
  };
  next = addLog(next, {
    id: command.operationId,
    type: 'interaction',
    day: game.day,
    characterId: character.id,
    actionId: command.kind === 'normal' ? command.actionId! : null,
    giftId: command.kind === 'gift' ? command.giftId! : null,
    delta: affected.results[0]!.delta,
    major: character.major,
    cost: {
      energy: definition.cost.energy ?? 0,
      stamina: definition.cost.stamina ?? 0,
      tokens: definition.cost.tokens ?? 0,
    },
  });
  return next;
}

// Called once by daily settlement, after natural recovery and before room events.
export function settleIdleInteractions(game: GameState): GameState {
  if (game.setup !== 'done') return game;
  let next = game;
  for (const [index, character] of game.characters.entries()) {
    if (
      character.daily.interactions > 0 ||
      character.daily.gifts > 0 ||
      character.daily.identityParticipated
    )
      continue;
    const choices = INTERACTIONS.filter(
      (action) =>
        !action.consentRequired &&
        !action.recovery &&
        !costError(next, [character.id], action.cost),
    );
    if (!choices.length) continue;
    const randomSeed = nextRandom(next.randomSeed);
    const action = choices[randomSeed % choices.length]!;
    const command: InteractionCommand = {
      operationId: `${ACTIVITY.autoInteractionPrefix}${game.day}:${index}`,
      expectedDay: game.day,
      characterId: character.id,
      kind: 'normal',
      actionId: action.id,
    };
    next = commitInteraction(
      { ...next, randomSeed },
      command,
      character,
      action,
    );
  }
  return next;
}
