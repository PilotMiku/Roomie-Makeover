import { useEffect, useRef } from 'react';
import { playChime, stopSound } from '../audio/sound';
import { useGame } from './game';

export function useSoundEffects() {
  const { game, generation, activeSlot } = useGame();
  const token = `${activeSlot}:${generation}`;
  const lastId = game.logs.at(-1)?.id;
  const previous = useRef({ token, lastId });
  useEffect(() => {
    const changed =
      previous.current.token === token && previous.current.lastId !== lastId;
    previous.current = { token, lastId };
    if (!game.settings.sound) stopSound();
    else if (changed && !document.hidden) void playChime();
  }, [token, lastId, game.settings.sound]);
}
