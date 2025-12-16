import { z } from 'zod';

const timestamp = z.preprocess((v) => {
  if (typeof v === 'string' || typeof v === 'number') return Number(v);
  return v;
}, z.number().int().nonnegative().optional());

export const songSchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  artist: z.string().min(1).max(256),
  artistAddress: z.string().min(1),
  genre: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
  ipfsHash: z.string().min(1),
  paymentModel: z.string().min(1),
  coverArt: z.string().url().max(2048).optional().nullable(),
  audioUrl: z.string().url().max(2048).optional().nullable(),
  claimStreamId: z.string().max(512).optional().nullable(),
  nonce: z.string().max(128).optional(),
  timestamp,
  signer: z.string().optional(),
  signature: z.string().optional(),
});

export const playSchema = z.object({
  listenerAddress: z.string().min(1),
  amount: z.preprocess((v) => (typeof v === 'string' || typeof v === 'number' ? Number(v) : v), z.number().nonnegative()),
  paymentType: z.string().min(1),
  nonce: z.string().max(128).optional(),
  signer: z.string().optional(),
  timestamp,
  signature: z.string().optional(),
});

export const claimSchema = z.object({
  songId: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  artist: z.string().min(1).max(256),
  ipfsHash: z.string().min(1),
  artistAddress: z.string().min(1),
  epistemicTier: z.number().optional(),
  networkTier: z.number().optional(),
  memoryTier: z.number().optional(),
  nonce: z.string().max(128).optional(),
  signer: z.string().optional(),
  signature: z.string().optional(),
  timestamp,
});

export const analyticsQuerySchema = z.object({
  days: z.preprocess((v) => (v === undefined ? 30 : Number(v)), z.number().int().min(1).max(90)).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const songsQuerySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  model: z.string().optional(),
  limit: z.preprocess((v) => (v === undefined ? 50 : Number(v)), z.number().int().min(1).max(100)).optional(),
  offset: z.preprocess((v) => (v === undefined ? 0 : Number(v)), z.number().int().min(0)).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  cursor: z.string().optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const artistSongsQuerySchema = z.object({
  limit: z.preprocess((v) => (v === undefined ? 50 : Number(v)), z.number().int().min(1).max(200)).optional(),
  offset: z.preprocess((v) => (v === undefined ? 0 : Number(v)), z.number().int().min(0)).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  format: z.enum(['json', 'csv']).optional(),
  all: z.preprocess((v) => String(v ?? 'false').toLowerCase() === 'true', z.boolean()).optional(),
});

export const topSongsQuerySchema = z.object({
  limit: z.preprocess((v) => (v === undefined ? 10 : Number(v)), z.number().int().min(1).max(50)).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const playsQuerySchema = z.object({
  limit: z.preprocess((v) => (v === undefined ? 100 : Number(v)), z.number().int().min(1).max(1000)).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const healthDetailsQuerySchema = z.object({
  client_ts: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().optional()).optional(),
});

function toIssues(issues: z.ZodIssue[]) {
  return issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
}

export function validateBody(schema: z.ZodTypeAny) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'invalid_request', issues: toIssues(result.error.issues) });
    }
    req.body = result.data;
    return next();
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'invalid_request', issues: toIssues(result.error.issues) });
    }
    req.query = result.data;
    return next();
  };
}
