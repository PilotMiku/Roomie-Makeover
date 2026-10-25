import { ACTIVITY, GAME } from '../data/constants';
import { emptyDaily } from './activityState';
import { DEFAULT_BOTTOM_COLOR, INITIAL_CLOTHES } from '../data/clothes';
import { type BedType, type GameState, type Room } from './model';

export function createBeds(
  roomId: string,
  capacity: Room['capacity'],
  bedType: BedType,
): Room['beds'] {
  return Array.from({ length: capacity }, (_, index) => ({
    id: `${roomId}-bed-${index + 1}`,
    unit: bedType === 'loft' ? index + 1 : Math.floor(index / 2) + 1,
    level: bedType === 'loft' ? 'loft' : index % 2 === 0 ? 'upper' : 'lower',
  }));
}

export function createGame(now: number, fast = false): GameState {
  const roomId = 'room-101';
  const examples = [
    {
      name: '林小满',
      personality: '慢热的点子王',
      major: 'computing',
      hairColor: '#55483f',
      topColor: '#7e9c83',
    },
    {
      name: '许知夏',
      personality: '随身带着好心情',
      major: 'art',
      hairColor: '#a47956',
      topColor: '#bd8e84',
    },
    {
      name: '周云舟',
      personality: '寝室散步发起人',
      major: 'sport',
      hairColor: '#41494e',
      topColor: '#819db2',
    },
    {
      name: '沈星禾',
      personality: '普通日子的收藏家',
      major: 'daily',
      hairColor: '#76617d',
      topColor: '#aa9ac1',
    },
  ] as const;
  return {
    version: GAME.version,
    slotId: 'slot-1',
    name: '第一间小屋',
    setup: 'done',
    day: 1,
    lastSettledDay: 0,
    identityActions: { day: 1, roomIds: [], operationIds: [] },
    wallet: { tokens: ACTIVITY.startingTokens },
    eventProgress: [],
    player: { identity: 'leader', age: GAME.defaultAge, customTitle: '' },
    rooms: [
      {
        id: roomId,
        name: '101 · 晴窗小屋',
        habitability: GAME.defaultHabitability,
        capacity: 4,
        bedType: 'loft',
        beds: createBeds(roomId, 4, 'loft'),
        facilities: { bathroom: 'shared', dryWet: false },
      },
    ],
    characters: examples.map((example, index) => ({
      id: `resident-${index + 1}`,
      name: example.name,
      address: example.name,
      pronouns: '他',
      personality: example.personality,
      age: GAME.defaultAge,
      major: example.major,
      customMajor: '',
      tags: [],
      tagProgressGranted: false,
      condition: {
        leaveUntilDay: 0,
        staminaZero: false,
        moodZero: false,
        energyZero: false,
      },
      roleplay: false,
      appearance: {
        hairColor: example.hairColor,
        topColor: example.topColor,
        skinColor: '#f1d3b3',
        bottomColor: DEFAULT_BOTTOM_COLOR,
        face: 'gentle',
      },
      outfit: {
        hair: `basic-hair-${index + 1}`,
        top: 'basic-top',
        bottom: 'basic-bottom',
        skirt: null,
        coat: null,
        shoes: null,
        socks: null,
        accessory: null,
        makeup: null,
      },
      roomId,
      bedId: `${roomId}-bed-${index + 1}`,
      stats: {
        affection: 40,
        mood: 65,
        stamina: 70,
        energy: 70,
        progress: 0,
        rapport: 30,
      },
      settledDays: 0,
      daily: emptyDaily(1),
      growth: [],
    })),
    clock: { anchor: now, lastObserved: now, mode: fast ? 'fast' : 'normal' },
    randomSeed: 20261024,
    pendingEvents: [],
    resolvedEventIds: [],
    wardrobe: {
      unlockedIds: [...INITIAL_CLOTHES],
      presets: [],
    },
    settings: { roleplay: false, sound: false },
    legacy: { runs: 0, achievements: [], encyclopedia: [], portraits: [] },
    logs: [],
  };
}

export function createNewGame(now: number, fast = false): GameState {
  const game = createGame(now, fast);
  return {
    ...game,
    setup: 'identity',
    characters: [],
    rooms: [{ ...game.rooms[0]!, name: '樱桃奶油寝室' }],
  };
}
