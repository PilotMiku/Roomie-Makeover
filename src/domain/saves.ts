import { z } from 'zod';
import { GAME, SAVES } from '../data/constants';
import { decodeSave } from './migrations';
import { saveSchema, type GameState, type Save } from './model';
import { decodeCompact, encodeCompact } from './compactSave';

export type SlotId = (typeof SAVES.slots)[number];
export const slotIdSchema = z.enum(SAVES.slots);
export function slotKey(slotId: SlotId): string {
  return `roomdev:slot:${slotId.slice(-1)}`;
}
export const deletedSlotSchema = z.strictObject({
  deleted: z.literal(true),
  commitId: z.string().min(1).max(80),
});
// Local metadata shares the single atomic storage record with the game.
const storedSchema = z.strictObject({
  revision: saveSchema.shape.revision,
  commitId: saveSchema.shape.commitId,
  game: z.unknown(),
  sourceRaw: z.string().max(SAVES.maxImportBytes).optional(),
});
export function encodeStored(save: Save, sourceRaw: string | null): string {
  const normal = JSON.stringify(
    storedSchema.parse({ ...save, ...(sourceRaw ? { sourceRaw } : {}) }),
  );
  return new TextEncoder().encode(normal).byteLength > SAVES.compactStorageBytes
    ? encodeCompact(save, sourceRaw)
    : normal;
}
export function decodeStored(value: unknown): {
  save: Save;
  sourceRaw: string | null;
  migrated: boolean;
  fromVersion: string;
} {
  const parsed = storedSchema.parse(decodeCompact(value));
  const { sourceRaw, ...archive } = parsed;
  const originalVersion = (parsed.game as { version?: unknown } | null)
    ?.version;
  return {
    save: decodeSave(archive),
    sourceRaw: sourceRaw ?? null,
    migrated: originalVersion !== GAME.version,
    fromVersion: String(originalVersion),
  };
}
export interface ImportPreview {
  raw: string;
  game: GameState;
  fromVersion: string;
  migrated: boolean;
  sourceRaw: string | null;
}
export function parseArchiveJson(raw: string): unknown {
  return JSON.parse(raw.startsWith('\uFEFF') ? raw.slice(1) : raw);
}
export async function readImportFile(
  file: Pick<File, 'size' | 'arrayBuffer'>,
): Promise<ImportPreview> {
  if (file.size > SAVES.maxImportBytes)
    throw new Error('文件超过 2 MiB，当前有效存档未修改。');
  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      '文件无法读取或不是有效的 UTF-8 JSON，当前有效存档未修改。',
    );
  }
  return previewImport(raw);
}
export function previewImport(raw: string): ImportPreview {
  if (new TextEncoder().encode(raw).byteLength > SAVES.maxImportBytes)
    throw new Error('文件超过 2 MiB，请选择较小的单槽 JSON 备份。');
  let value: unknown;
  try {
    value = parseArchiveJson(raw);
  } catch {
    throw new Error('JSON 无法读取，当前存档未修改。');
  }
  const parsed = decodeStored(value);
  return {
    raw,
    game: parsed.save.game,
    fromVersion: parsed.fromVersion,
    migrated: parsed.migrated,
    sourceRaw: parsed.sourceRaw ?? (parsed.migrated ? raw : null),
  };
}
export function exportArchive(game: GameState): string {
  const save = saveSchema.parse({ revision: 0, commitId: 'export', game });
  const normal = JSON.stringify(save);
  const raw =
    new TextEncoder().encode(normal).byteLength <= SAVES.maxImportBytes
      ? normal
      : encodeCompact(save);
  if (new TextEncoder().encode(raw).byteLength > SAVES.maxImportBytes)
    throw new Error(
      '完整备份超过 2 MiB，当前数据没有裁剪。请保留本页并检查存档中的异常超长内容。',
    );
  return raw;
}
export function importError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return `存档校验失败（${issue?.path.join('.') || '根结构'}）：${issue?.message ?? '数据不合法'}。当前有效存档未修改。`;
  }
  return error instanceof Error
    ? error.message
    : '无法读取存档，当前有效存档未修改。';
}
