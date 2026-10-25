import { WARDROBE } from '../data/clothes';
import type { Character } from '../domain/model';
import { avatarPixels, avatarSignature } from './pixels';

const cache = new Map<string, string>();
export function avatarImage(character: Character): string | undefined {
  const signature = avatarSignature(character);
  if (cache.has(signature)) return cache.get(signature);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  if (!context) return;
  for (const pixel of avatarPixels(character)) {
    context.fillStyle = pixel.fill;
    context.fillRect(pixel.x, pixel.y, pixel.w, pixel.h);
  }
  const src = canvas.toDataURL('image/png');
  if (cache.size >= WARDROBE.cacheLimit)
    cache.delete(cache.keys().next().value!);
  cache.set(signature, src);
  return src;
}
