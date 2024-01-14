import { z } from 'zod';

export const fileSchema = z.object({
  size: z.number(),
  buffer: z.instanceof(Buffer),
  originalname: z.string(),
  mimetype: z.string(),
});
