import { z } from 'zod';
import { slotIdSchema } from '../domain/saves';
import { gameSchema } from '../domain/model';

const target = { slotId: slotIdSchema, expectedRaw: z.string().nullable() };
export const slotCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('switch'), slotId: slotIdSchema }),
  z.strictObject({
    type: z.literal('create'),
    ...target,
    name: gameSchema.shape.name,
  }),
  z.strictObject({
    type: z.literal('rename'),
    ...target,
    name: gameSchema.shape.name,
  }),
  z.strictObject({
    type: z.literal('delete'),
    ...target,
    confirmed: z.literal(true),
  }),
  z.strictObject({
    type: z.literal('import'),
    ...target,
    raw: z.string(),
    confirmed: z.literal(true),
  }),
]);
export type SlotCommand = z.infer<typeof slotCommandSchema>;
export interface SaveActionResult {
  error?: string;
  raw?: string;
  filename?: string;
}
