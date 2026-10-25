import { findClothing, type OpenSlot } from '../data/clothes';
import type { Character } from '../domain/model';

type Look = Pick<Character, 'appearance' | 'outfit'>;
export interface Pixel {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}
const MASK = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhhsssshhh...',
  '...hhsssssshh...',
  '...hssessessh...',
  '....ssssssss....',
  '.....ssmmss.....',
  '......ssss......',
  '.....tttttt.....',
  '...tttttttttt...',
  '..tttttttttttt..',
  '..tttttttttttt..',
  '...tttttttttt...',
  '....tttttttt....',
];
const WHITE = '#fff5fa',
  GOLD = '#f1cf82',
  INK = '#553341';
const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): Pixel => ({ x, y, w, h, fill });
function shift(pixels: Pixel[], dx: number, dy: number) {
  return pixels.map((pixel) => ({
    ...pixel,
    x: pixel.x + dx,
    y: pixel.y + dy,
  }));
}
function head(look: Look) {
  const palette: Record<string, string> = {
    h: look.appearance.hairColor,
    s: look.appearance.skinColor,
    e: look.appearance.skinColor,
    m: look.appearance.skinColor,
  };
  const face: Pixel[] = [],
    hair: Pixel[] = [];
  MASK.slice(0, 10).forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      if (palette[symbol])
        (symbol === 'h' ? hair : face).push(rect(x, y, 1, 1, palette[symbol]));
    }),
  );
  const template = look.appearance.face ?? 'gentle';
  if (template === 'bright')
    face.push(rect(3, 7, 1, 1, palette.s!), rect(12, 7, 1, 1, palette.s!));
  if (template === 'cool')
    face.push(rect(5, 8, 1, 1, '#fff0f7'), rect(10, 8, 1, 1, '#fff0f7'));
  const eye = (x: number, y: number, w = 1, h = 1) =>
    face.push(rect(x, y, w, h, INK));
  switch (template) {
    case 'bright':
      eye(5, 6, 2, 2);
      eye(9, 6, 2, 2);
      face.push(rect(5, 6, 1, 1, WHITE), rect(9, 6, 1, 1, WHITE));
      break;
    case 'cool':
      eye(5, 6, 2);
      eye(9, 6, 2);
      eye(5, 5, 2);
      eye(9, 5, 2);
      break;
    case 'sleepy':
      eye(5, 7, 2);
      eye(9, 7, 2);
      eye(4, 6);
      eye(11, 6);
      break;
    case 'cat':
      eye(5, 6, 2);
      eye(9, 6, 2);
      eye(4, 5);
      eye(11, 5);
      face.push(rect(4, 7, 1, 1, '#bd886c'), rect(11, 7, 1, 1, '#bd886c'));
      break;
    case 'glasses':
      eye(5, 6);
      eye(10, 6);
      face.push(
        rect(3, 5, 4, 1, INK),
        rect(9, 5, 4, 1, INK),
        rect(3, 7, 4, 1, INK),
        rect(9, 7, 4, 1, INK),
        rect(3, 5, 1, 3, INK),
        rect(12, 5, 1, 3, INK),
        rect(7, 6, 2, 1, INK),
      );
      break;
    default:
      eye(5, 6);
      eye(10, 6);
      eye(5, 5);
      eye(10, 5);
  }
  face.push(rect(7, 8, 2, 1, template === 'cool' ? '#a97087' : '#c77598'));
  const makeup: Pixel[] = [];
  if (look.outfit.makeup) {
    makeup.push(
      rect(4, 7, 2, 1, '#f386ad'),
      rect(10, 7, 2, 1, '#f386ad'),
      rect(7, 8, 2, 1, '#d14c80'),
      rect(6, 6, 1, 1, WHITE),
      rect(10, 6, 1, 1, WHITE),
    );
    if (look.outfit.makeup === 'doll-makeup')
      makeup.push(
        rect(4, 5, 3, 1, INK),
        rect(9, 5, 3, 1, INK),
        rect(4, 4, 1, 2, INK),
        rect(11, 4, 1, 2, INK),
        rect(4, 7, 1, 1, WHITE),
        rect(11, 7, 1, 1, WHITE),
      );
  }
  const accessory: Pixel[] = [];
  if (look.outfit.accessory === 'ribbon-crown')
    accessory.push(
      rect(4, 0, 3, 3, '#eb75a3'),
      rect(9, 0, 3, 3, '#eb75a3'),
      rect(7, 1, 2, 2, '#b83e70'),
    );
  if (look.outfit.accessory === 'maid-headband') {
    accessory.push(rect(3, 1, 10, 2, '#353247'));
    for (let x = 3; x <= 12; x += 2) accessory.push(rect(x, 0, 2, 2, WHITE));
  }
  const color = look.appearance.hairColor;
  switch (findClothing(look.outfit.hair)?.pattern ?? 0) {
    case 1:
      hair.push(rect(2, 5, 2, 7, color), rect(12, 5, 2, 7, color));
      break;
    case 2:
      hair.push(
        rect(3, 2, 8, 3, color),
        rect(4, 5, 3, 2, color),
        rect(12, 3, 1, 2, WHITE),
      );
      break;
    case 3:
      hair.push(rect(7, 0, 2, 2, color), rect(8, 0, 3, 1, color));
      break;
    case 4:
      hair.push(
        rect(0, 4, 3, 10, color),
        rect(13, 4, 3, 10, color),
        rect(0, 4, 4, 2, '#ed8eb9'),
        rect(12, 4, 4, 2, '#ed8eb9'),
      );
      break;
    case 5:
      hair.push(
        rect(12, 6, 3, 5, color),
        rect(13, 10, 2, 4, color),
        rect(12, 13, 3, 2, color),
        rect(12, 3, 2, 2, GOLD),
        rect(13, 13, 1, 1, WHITE),
      );
      break;
    case 6:
      hair.push(
        rect(1, 5, 3, 11, color),
        rect(12, 5, 3, 11, color),
        rect(0, 9, 2, 4, color),
        rect(14, 9, 2, 4, color),
        rect(3, 1, 3, 2, color),
        rect(10, 1, 3, 2, color),
      );
      break;
    case 7:
      hair.push(
        rect(0, 1, 4, 4, color),
        rect(12, 1, 4, 4, color),
        rect(1, 2, 2, 1, '#ed8eb9'),
        rect(13, 2, 2, 1, '#ed8eb9'),
      );
      break;
  }
  return { face, hair, makeup, accessory };
}
function avatarTop(look: Look): Pixel[] {
  const pixels: Pixel[] = [];
  MASK.forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      if (symbol === 't')
        pixels.push(rect(x, y, 1, 1, look.appearance.topColor));
    }),
  );
  switch (findClothing(look.outfit.top)?.pattern ?? 0) {
    case 1:
      pixels.push(
        rect(5, 10, 6, 1, WHITE),
        rect(6, 11, 4, 1, '#c45488'),
        rect(7, 12, 2, 1, WHITE),
      );
      break;
    case 2:
      pixels.push(
        rect(5, 10, 2, 2, WHITE),
        rect(9, 10, 2, 2, WHITE),
        rect(7, 12, 2, 1, WHITE),
      );
      break;
    case 3:
      pixels.push(rect(7, 11, 2, 3, GOLD), rect(6, 12, 4, 1, GOLD));
      break;
    case 4:
      pixels.push(
        rect(5, 11, 1, 3, WHITE),
        rect(10, 11, 1, 3, WHITE),
        rect(6, 14, 4, 1, WHITE),
      );
      break;
    case 5:
      pixels.push(rect(7, 11, 2, 4, GOLD), rect(6, 12, 4, 2, GOLD));
      break;
    case 6:
      pixels.push(
        rect(6, 12, 4, 3, GOLD),
        rect(9, 12, 2, 1, '#e69b53'),
        rect(7, 12, 1, 1, INK),
      );
      break;
    case 7:
      for (let x = 3; x <= 12; x += 2) pixels.push(rect(x, 14, 1, 1, WHITE));
      pixels.push(rect(5, 10, 6, 2, WHITE));
      break;
    case 8:
      pixels.push(
        rect(3, 10, 10, 6, '#353247'),
        rect(5, 10, 6, 2, WHITE),
        rect(7, 12, 2, 2, '#c45488'),
      );
      break;
  }
  return pixels;
}
export function avatarPixels(look: Look): Pixel[] {
  const { face, hair, accessory, makeup } = head(look);
  return [
    rect(0, 0, 16, 16, '#fff0f7'),
    ...avatarTop(look),
    ...face,
    ...hair,
    ...accessory,
    ...makeup,
  ];
}
export function avatarSignature(look: Look): string {
  return JSON.stringify([look.appearance, look.outfit]);
}

export function portraitLayers(look: Look): Record<OpenSlot | 'body', Pixel[]> {
  const { face, hair, accessory, makeup } = head(look);
  const skin = look.appearance.skinColor,
    top = look.appearance.topColor,
    bottom = look.appearance.bottomColor;
  const body = [
    ...shift(face, 8, 10),
    rect(14, 19, 4, 5, skin),
    rect(7, 28, 3, 9, skin),
    rect(22, 28, 3, 9, skin),
    rect(10, 36, 5, 13, skin),
    rect(17, 36, 5, 13, skin),
    rect(9, 47, 6, 3, '#8d687e'),
    rect(17, 47, 6, 3, '#8d687e'),
  ];
  const topPattern = findClothing(look.outfit.top)?.pattern ?? 0;
  const shirt = [
    rect(10, 23, 12, 11, top),
    rect(7, 24, 4, 8, top),
    rect(21, 24, 4, 8, top),
  ];
  switch (topPattern) {
    case 1:
      shirt.push(
        rect(6, 24, 5, 5, top),
        rect(21, 24, 5, 5, top),
        rect(12, 23, 8, 2, WHITE),
        rect(13, 25, 6, 2, '#c45488'),
        rect(15, 27, 2, 2, '#c45488'),
      );
      break;
    case 2:
      shirt.push(
        rect(11, 23, 3, 3, WHITE),
        rect(18, 23, 3, 3, WHITE),
        rect(13, 26, 2, 2, WHITE),
        rect(17, 26, 2, 2, WHITE),
        rect(15, 28, 2, 2, '#bb5181'),
      );
      break;
    case 3:
      shirt.push(
        rect(9, 24, 14, 12, top),
        rect(10, 33, 12, 2, GOLD),
        rect(15, 24, 2, 6, GOLD),
        rect(13, 26, 6, 2, GOLD),
      );
      break;
    case 4:
      shirt.push(
        rect(9, 23, 14, 13, top),
        rect(11, 21, 10, 3, top),
        rect(12, 24, 1, 7, WHITE),
        rect(19, 24, 1, 7, WHITE),
        rect(12, 32, 8, 1, WHITE),
      );
      break;
    case 5:
      shirt.push(
        rect(15, 25, 2, 7, GOLD),
        rect(12, 27, 8, 3, GOLD),
        rect(8, 24, 3, 1, WHITE),
        rect(21, 24, 3, 1, WHITE),
      );
      break;
    case 6:
      shirt.push(
        rect(12, 27, 7, 5, GOLD),
        rect(18, 27, 3, 2, '#e69b53'),
        rect(16, 27, 1, 1, INK),
      );
      break;
    case 7:
      shirt.push(rect(12, 23, 8, 3, WHITE), rect(15, 26, 2, 6, '#c45488'));
      for (let x = 9; x < 24; x += 2) shirt.push(rect(x, 33, 1, 2, WHITE));
      break;
    case 8:
      shirt.push(
        rect(7, 24, 18, 10, '#353247'),
        rect(6, 24, 5, 5, '#353247'),
        rect(21, 24, 5, 5, '#353247'),
        rect(11, 23, 10, 3, WHITE),
        rect(14, 26, 4, 3, '#bd4b7e'),
        rect(15, 29, 2, 5, WHITE),
      );
      for (let x = 6; x < 26; x += 2) shirt.push(rect(x, 28, 1, 2, WHITE));
      break;
  }
  const bottomPattern = findClothing(look.outfit.bottom)?.pattern ?? 0;
  const short = bottomPattern === 1 || bottomPattern === 5;
  const wide = bottomPattern === 2 || bottomPattern === 3;
  const length = short ? 6 : bottomPattern === 2 ? 9 : 13;
  const trousers = [
    rect(10, 33, 12, 3, bottom),
    rect(wide ? 8 : 10, 35, wide ? 7 : 5, length - 1, bottom),
    rect(17, 35, wide ? 7 : 5, length - 1, bottom),
  ];
  if (bottomPattern === 1)
    trousers.push(
      rect(10, 39, 5, 1, WHITE),
      rect(17, 39, 5, 1, WHITE),
      rect(9, 35, 3, 2, '#ed8eb9'),
    );
  if (bottomPattern === 2)
    trousers.push(rect(8, 41, 7, 1, GOLD), rect(17, 41, 7, 1, GOLD));
  if (bottomPattern === 3)
    trousers.push(rect(11, 36, 1, 10, WHITE), rect(20, 36, 1, 10, WHITE));
  if (bottomPattern === 4)
    for (let y = 35; y < 47; y += 3)
      for (const x of [10, 13, 17, 20])
        if ((y + x) % 2) trousers.push(rect(x, y, 2, 2, WHITE));
  if (bottomPattern === 5)
    trousers.push(
      rect(10, 38, 5, 2, '#f1cf82'),
      rect(17, 38, 5, 2, '#f1cf82'),
      rect(10, 34, 12, 1, WHITE),
    );
  if (bottomPattern === 6)
    trousers.push(
      rect(10, 40, 5, 3, GOLD),
      rect(17, 40, 5, 3, GOLD),
      rect(10, 34, 12, 1, WHITE),
    );
  if (bottomPattern === 7)
    for (let y = 36; y < 47; y += 3)
      trousers.push(rect(10, y, 5, 1, GOLD), rect(17, y, 5, 1, GOLD));
  const skirt: Pixel[] = [];
  if (look.outfit.skirt) {
    const maid = look.outfit.skirt === 'maid-skirt';
    const shade = maid
      ? '#353247'
      : look.outfit.skirt === 'star-dress'
        ? '#aa82ce'
        : '#ed8eb9';
    skirt.push(
      rect(10, 32, 12, 3, shade),
      rect(8, 35, 16, 4, shade),
      rect(6, 39, 20, 4, shade),
      rect(5, 43, 22, 2, shade),
    );
    for (let x = 6; x < 27; x += 2) skirt.push(rect(x, 44, 1, 2, WHITE));
    for (let x = 10; x < 23; x += 4)
      skirt.push(rect(x, 36, 1, 7, maid ? '#6a6078' : '#d6b1e4'));
    if (maid) {
      skirt.push(
        rect(12, 32, 8, 4, WHITE),
        rect(10, 36, 12, 6, WHITE),
        rect(9, 41, 14, 2, WHITE),
        rect(10, 45, 5, 4, '#353247'),
        rect(17, 45, 5, 4, '#353247'),
        rect(10, 45, 5, 1, WHITE),
        rect(17, 45, 5, 1, WHITE),
      );
    } else {
      skirt.push(
        rect(12, 32, 3, 2, WHITE),
        rect(17, 32, 3, 2, WHITE),
        rect(15, 33, 2, 3, '#bf527e'),
      );
      if (look.outfit.skirt === 'star-dress')
        for (const x of [8, 15, 22]) skirt.push(rect(x, 39, 2, 2, GOLD));
    }
  }
  return {
    body,
    bottom: look.outfit.skirt ? [] : trousers,
    top: shirt,
    skirt,
    hair: shift(hair, 8, 10),
    accessory: shift(accessory, 8, 10),
    makeup: shift(makeup, 8, 10),
  };
}
