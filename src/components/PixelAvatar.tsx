import { avatarImage } from '../render/avatar';
import { useMemo } from 'react';
import type { Character } from '../domain/model';

export function PixelAvatar({ character }: { character: Character }) {
  const src = useMemo(() => avatarImage(character), [character]);
  return (
    <span className="avatar-wrap" aria-hidden="true">
      <span className="mood-bubble">
        {character.stats.mood >= 60
          ? '😊'
          : character.stats.mood >= 30
            ? '🙂'
            : '😴'}
      </span>
      {src ? (
        <img className="pixel-avatar" src={src} alt="" draggable={false} />
      ) : (
        <span className="pixel-avatar">{character.name.slice(0, 1)}</span>
      )}
    </span>
  );
}
