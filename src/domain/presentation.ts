import { STAT_LABELS } from '../data/constants';
import { IDENTITIES } from '../data/identities';
import { MAJORS } from '../data/rules';
import type { Character, GameState, StatKey } from './model';

export function identityLabel(game: GameState) {
  return game.player.identity === 'custom'
    ? game.player.customTitle
    : IDENTITIES[game.player.identity].name;
}
export function identityRules(game: GameState) {
  const rules = IDENTITIES[game.player.identity];
  if (
    game.player.identity === 'custom' &&
    /家长|宿管|楼管|辅导员|老师|教师|管理员|校长/u.test(game.player.customTitle)
  )
    return { ...rules, roleplay: false };
  return rules;
}
export function canManage(game: GameState, section: 'room' | 'residents') {
  return game.setup !== 'done' || identityRules(game)[section];
}
export function roleplayEnabled(game: GameState, character: Character) {
  return (
    game.settings.roleplay &&
    character.roleplay &&
    character.age >= 18 &&
    identityRules(game).roleplay
  );
}
export function statLabel(
  game: GameState,
  character: Character | undefined,
  key: StatKey,
) {
  return key === 'rapport' && character && roleplayEnabled(game, character)
    ? '听话值'
    : STAT_LABELS[key];
}
export function majorLabel(character: Character) {
  return character.major === 'custom'
    ? character.customMajor
    : MAJORS[character.major].label;
}
