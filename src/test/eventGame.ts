import { findEvent } from '../data/events';
import { createGame } from '../domain/initial';
import type { GameState } from '../domain/model';
import { settleDay } from '../domain/rules';

// Search genuine seeded settlements, without adding test switches to game logic.
export function queuedEvent(eventId = 'ribbon-studio', now = 1000): GameState {
  const event = findEvent(eventId)!;
  for (let seed = 1; seed < 2000; seed++) {
    let game = createGame(now);
    game.player.identity = event.condition.identities?.[0] ?? 'leader';
    game.randomSeed = seed;
    game.characters[0]!.tags = ['可爱'];
    for (let day = 1; day <= Math.max(4, event.condition.minDay); day++) {
      game = settleDay(game, day, 'manual');
      if (game.pendingEvents.some((pending) => pending.eventId === eventId))
        return game;
    }
  }
  throw new Error(`No reachable seeded fixture: ${eventId}`);
}
