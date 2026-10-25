import { useSearchParams } from 'react-router-dom';
import type { GameState } from '../domain/model';

export function useRoomView(game: GameState) {
  const [params, setParams] = useSearchParams();
  const room =
    game.rooms.find((candidate) => candidate.id === params.get('room')) ??
    game.rooms[0]!;
  const chooseRoom = (id: string, residentId?: string) => {
    if (!id) return;
    const next = new URLSearchParams(params);
    next.set('room', id);
    if (residentId) next.set('resident', residentId);
    else next.delete('resident');
    setParams(next);
  };
  return { room, params, chooseRoom };
}
