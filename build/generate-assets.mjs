import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

// Original pixel-heart icons and a three-note chime, with no external artwork.
await mkdir('public/icons', { recursive: true });
await mkdir('public/sounds', { recursive: true });
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
for (const size of [192, 512]) {
  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = Math.floor((x * 32) / size),
        py = Math.floor((y * 32) / size);
      const heart =
        (py >= 9 &&
          py <= 15 &&
          ((px >= 8 && px <= 13) || (px >= 18 && px <= 23))) ||
        (py >= 12 && py <= 17 && px >= 7 && px <= 24) ||
        (py >= 18 && py <= 24 && Math.abs(px - 15.5) <= 24.5 - py);
      const frame =
        ((px === 3 || px === 28) && py >= 3 && py <= 28) ||
        ((py === 3 || py === 28) && px >= 3 && px <= 28);
      rows.set(
        heart
          ? [184, 62, 112, 255]
          : frame
            ? [226, 160, 190, 255]
            : [255, 239, 247, 255],
        y * (1 + size * 4) + 1 + x * 4,
      );
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  await writeFile(
    `public/icons/heart-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(rows)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
const rate = 16000,
  samples = Math.floor(rate * 0.36),
  wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let index = 0; index < samples; index++) {
  const time = index / rate,
    note = Math.min(2, Math.floor(time / 0.12)),
    phase = time - note * 0.12;
  const amplitude = Math.min(1, phase / 0.006) * Math.max(0, 1 - phase / 0.12);
  wav.writeInt16LE(
    Math.round(
      Math.sin(2 * Math.PI * [523.25, 659.25, 783.99][note] * phase) *
        amplitude *
        5200,
    ),
    44 + index * 2,
  );
}
await writeFile('public/sounds/chime.wav', wav);
