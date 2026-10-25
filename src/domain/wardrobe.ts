import { nextRandom } from './random';
import { z } from 'zod';
import {
  CLOTHES,
  FIRST_LOOK_EVENT,
  OPEN_SLOTS,
  CORE_SLOTS,
  WARDROBE,
  findClothing,
} from '../data/clothes';
import { gameSchema, outfitColorsSchema, type GameState } from './model';
import { isAdultText } from './adultText';
import { canManage } from './presentation';
import { addLog } from './log';
import { syncProgress } from './progress';

const identifier = z.string().min(1).max(80);
const wardrobeCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('equip'),
    characterId: identifier,
    slot: z.enum(OPEN_SLOTS),
    itemId: identifier,
  }),
  z.strictObject({
    type: z.literal('color'),
    characterId: identifier,
    colors: outfitColorsSchema,
  }),
  z.strictObject({ type: z.literal('random'), characterId: identifier }),
  z.strictObject({ type: z.literal('maid-set'), characterId: identifier }),
  z.strictObject({
    type: z.literal('unequip'),
    characterId: identifier,
    slot: z.enum(['skirt', 'accessory', 'makeup']),
  }),
  z.strictObject({
    type: z.literal('save-preset'),
    characterId: identifier,
    name: z
      .string()
      .trim()
      .min(1, '请给套装起个名字')
      .max(WARDROBE.nameLimit, '套装名称最多 40 字')
      .refine(isAdultText, '套装名称请使用校园设定'),
  }),
  z.strictObject({
    type: z.literal('apply-preset'),
    characterId: identifier,
    presetId: identifier,
  }),
  z.strictObject({ type: z.literal('delete-preset'), presetId: identifier }),
]);
export type WardrobeCommand = z.infer<typeof wardrobeCommandSchema>;
export function clothingProgressError(
  character: Pick<GameState['characters'][number], 'stats'>,
  itemId: string | null,
) {
  const minimum = findClothing(itemId)?.minProgress ?? 0;
  return character.stats.progress < minimum
    ? `这位室友的男娘进度需要达到 ${minimum} 才能使用该妆造。`
    : undefined;
}
export function changeWardrobe(
  game: GameState,
  input: unknown,
): { game: GameState; error?: string } {
  const fail = (error: string) => ({ game, error });
  if (!canManage(game, 'residents'))
    return fail('当前身份只可查看衣柜；可切换身份后管理室友。');
  const parsed = wardrobeCommandSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const command = parsed.data;
  const character =
    'characterId' in command
      ? game.characters.find(
          (candidate) => candidate.id === command.characterId,
        )
      : undefined;
  if ('characterId' in command && !character)
    return fail('请选择存在的常住室友。');
  let next = game;
  let action:
    | 'equip'
    | 'color'
    | 'random'
    | 'preset-save'
    | 'preset-apply'
    | 'preset-delete';
  let presetName: string | null = null;
  let itemIds: string[] = [];
  let updated = character;
  if (command.type === 'maid-set') {
    if (character!.stats.progress < 100)
      return fail('这位室友的男娘进度达到 100 才能解锁女仆装。');
    const pieces = [
      'maid-blouse',
      'maid-skirt',
      'maid-headband',
      'doll-makeup',
    ];
    if (pieces.some((id) => !game.wardrobe.unlockedIds.includes(id)))
      return fail('女仆套装尚未解锁。');
    updated = {
      ...character!,
      outfit: {
        ...character!.outfit,
        top: pieces[0]!,
        skirt: pieces[1]!,
        accessory: pieces[2]!,
        makeup: pieces[3]!,
      },
    };
    action = 'equip';
    itemIds = pieces;
  } else if (command.type === 'unequip') {
    updated = {
      ...character!,
      outfit: { ...character!.outfit, [command.slot]: null },
    };
    action = 'equip';
  } else if (command.type === 'equip') {
    const clothing = findClothing(command.itemId);
    if (!clothing || clothing.slot !== command.slot)
      return fail('服装不存在或不属于该槽位。');
    if (!game.wardrobe.unlockedIds.includes(clothing.id))
      return fail('这件服装尚未解锁。');
    const error = clothingProgressError(character!, clothing.id);
    if (error) return fail(error);
    updated = {
      ...character!,
      outfit: { ...character!.outfit, [command.slot]: clothing.id },
    };
    action = 'equip';
    itemIds = [clothing.id];
  } else if (command.type === 'color') {
    updated = {
      ...character!,
      appearance: { ...character!.appearance, ...command.colors },
    };
    action = 'color';
  } else if (command.type === 'random') {
    let seed = game.randomSeed;
    const outfit = { ...character!.outfit };
    for (const slot of OPEN_SLOTS) {
      const candidates = CLOTHES.filter(
        (item) =>
          item.slot === slot &&
          game.wardrobe.unlockedIds.includes(item.id) &&
          !clothingProgressError(character!, item.id),
      );
      if (!candidates.length) {
        if (CORE_SLOTS.includes(slot as (typeof CORE_SLOTS)[number]))
          return fail('该槽位还没有可用服装。');
        outfit[slot as 'skirt' | 'accessory' | 'makeup'] = null;
        continue;
      }
      seed = nextRandom(seed);
      outfit[slot] = candidates[seed % candidates.length]!.id;
    }
    updated = { ...character!, outfit };
    next = { ...game, randomSeed: seed };
    action = 'random';
    itemIds = OPEN_SLOTS.map((slot) => outfit[slot]).filter(
      (id): id is string => id !== null,
    );
  } else if (command.type === 'save-preset') {
    if (game.wardrobe.presets.length >= WARDROBE.maxPresets)
      return fail('最多收藏 50 套搭配，请先删除不需要的套装。');
    const preset = {
      id: crypto.randomUUID(),
      name: command.name,
      outfit: { ...character!.outfit },
      colors: outfitColorsSchema.parse({
        hairColor: character!.appearance.hairColor,
        topColor: character!.appearance.topColor,
        bottomColor: character!.appearance.bottomColor,
      }),
    };
    next = {
      ...game,
      wardrobe: {
        ...game.wardrobe,
        presets: [...game.wardrobe.presets, preset],
      },
      resolvedEventIds: game.resolvedEventIds.includes(FIRST_LOOK_EVENT)
        ? game.resolvedEventIds
        : [...game.resolvedEventIds, FIRST_LOOK_EVENT],
    };
    action = 'preset-save';
    presetName = preset.name;
  } else {
    const preset = game.wardrobe.presets.find(
      (candidate) => candidate.id === command.presetId,
    );
    if (!preset) return fail('套装不存在，可能已在其他操作中删除。');
    if (command.type === 'delete-preset') {
      next = {
        ...game,
        wardrobe: {
          ...game.wardrobe,
          presets: game.wardrobe.presets.filter(
            (candidate) => candidate.id !== preset.id,
          ),
        },
      };
      action = 'preset-delete';
    } else {
      for (const slot of OPEN_SLOTS)
        if (
          preset.outfit[slot] !== null &&
          (!game.wardrobe.unlockedIds.includes(preset.outfit[slot]!) ||
            findClothing(preset.outfit[slot])?.slot !== slot)
        )
          return fail('套装含有未解锁或槽位不符的服装。');
      for (const slot of OPEN_SLOTS) {
        const error = clothingProgressError(character!, preset.outfit[slot]);
        if (error) return fail(error);
      }
      updated = {
        ...character!,
        outfit: { ...preset.outfit },
        appearance: { ...character!.appearance, ...preset.colors },
      };
      action = 'preset-apply';
      itemIds = OPEN_SLOTS.map((slot) => preset.outfit[slot]).filter(
        (id): id is string => id !== null,
      );
    }
    presetName = preset.name;
  }
  if (updated && updated !== character)
    next = {
      ...next,
      characters: next.characters.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    };
  next = addLog(next, {
    id: crypto.randomUUID(),
    type: 'wardrobe',
    day: game.day,
    action,
    characterId: character?.id ?? null,
    itemIds,
    presetName,
  });
  next = syncProgress(next);
  const validated = gameSchema.safeParse(next);
  return validated.success
    ? { game: validated.data }
    : fail('穿搭数据未通过校验，已保留原有造型。');
}
