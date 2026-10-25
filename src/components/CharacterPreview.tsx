import type { Character } from '../domain/model';
import { portraitLayers } from '../render/pixels';
import type { OpenSlot } from '../data/clothes';

export function CharacterPreview({
  character,
  focusSlot,
  label,
}: {
  character: Pick<Character, 'name' | 'appearance' | 'outfit'>;
  focusSlot?: OpenSlot;
  label?: string;
}) {
  const layers = portraitLayers(character);
  const viewBox =
    focusSlot === 'hair'
      ? '6 8 20 22'
      : focusSlot === 'top'
        ? '5 21 22 16'
        : focusSlot === 'bottom' || focusSlot === 'skirt'
          ? '6 32 20 18'
          : focusSlot === 'accessory' || focusSlot === 'makeup'
            ? '5 7 22 24'
            : '0 0 32 52';
  return (
    <svg
      className={focusSlot ? 'clothing-swatch' : 'full-character'}
      viewBox={viewBox}
      role={focusSlot ? undefined : 'img'}
      aria-hidden={focusSlot ? true : undefined}
      aria-label={
        focusSlot ? undefined : (label ?? `${character.name}的完整穿搭预览`)
      }
      shapeRendering="crispEdges"
    >
      {(
        [
          'body',
          'bottom',
          'top',
          'skirt',
          'hair',
          'accessory',
          'makeup',
        ] as const
      ).map((layer) => (
        <g key={layer} data-layer={layer}>
          {layers[layer].map((pixel, index) => (
            <rect
              key={index}
              x={pixel.x}
              y={pixel.y}
              width={pixel.w}
              height={pixel.h}
              fill={pixel.fill}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
