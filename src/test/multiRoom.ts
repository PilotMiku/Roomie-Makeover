import { customizeGame, type CharacterInput } from '../domain/customize';
import { createGame } from '../domain/initial';
import type { GameState, Room } from '../domain/model';

export function residentInput(
  game: GameState,
  roomId: string,
  bedId: string,
): CharacterInput {
  const template = createGame(0).characters[0]!;
  return {
    name: `新室友 ${game.characters.length + 1}`,
    address: '室友',
    pronouns: '他',
    age: 20,
    personality: '喜欢收集寝室小故事',
    major: (
      [
        'daily',
        'art',
        'sport',
        'computing',
        'literature',
        'medicine',
        'music',
      ] as const
    )[game.characters.length % 7]!,
    customMajor: '',
    tags: ['可爱'],
    roleplay: false,
    appearance: { ...template.appearance },
    roomId,
    bedId,
    adultConfirmed: true,
  };
}
export function multiRoomGame(
  now = 1000,
  capacities: Room['capacity'][] = [4, 6, 8, 6],
): GameState {
  let game = createGame(now);
  for (const [index, capacity] of capacities.entries()) {
    const input = {
      name:
        index === 0
          ? '101 · 晴窗小屋'
          : `${101 + index} · ${['晴窗', '草莓', '月亮', '樱桃', '奶油', '云朵'][index]}小屋`,
      capacity,
      bedType: index % 2 ? ('bunk' as const) : ('loft' as const),
      facilities: {
        bathroom:
          index % 3 === 0
            ? ('shared' as const)
            : index % 3 === 1
              ? ('private' as const)
              : ('none' as const),
        dryWet: index % 3 === 1,
      },
    };
    const result = customizeGame(
      game,
      index === 0
        ? { type: 'room', roomId: game.rooms[0]!.id, input }
        : { type: 'room-create', input },
      now,
    );
    if (result.error) throw new Error(result.error);
    game = result.game;
    const room = game.rooms[index]!;
    for (const bed of room.beds) {
      if (game.characters.some((character) => character.bedId === bed.id))
        continue;
      const added = customizeGame(
        game,
        { type: 'character', input: residentInput(game, room.id, bed.id) },
        now,
      );
      if (added.error) throw new Error(added.error);
      game = added.game;
    }
  }
  return game;
}
