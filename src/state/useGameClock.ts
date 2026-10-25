import { useEffect } from 'react';
import { GAME } from '../data/constants';
import { useGame } from './game';
import { isSaveKey } from './persistence';

export function useGameClock() {
  useEffect(() => {
    const { initialize, tick, detectConflict } = useGame.getState();
    initialize();
    const timer = window.setInterval(tick, GAME.checkInterval);
    const storage = (event: StorageEvent) => {
      if (isSaveKey(event.key)) detectConflict();
    };
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    window.addEventListener('popstate', tick);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
      window.removeEventListener('popstate', tick);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
}
