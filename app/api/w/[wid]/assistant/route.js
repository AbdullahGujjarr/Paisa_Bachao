import { z } from 'zod';
import { wsRoute, readJson, ApiError } from '@/lib/api';
import { AI_DAILY_LIMIT, aiEnabled } from '@/lib/ai';
import { rateLimit } from '@/lib/rateLimit';
import { answerWithAI, answerWithRules } from '@/lib/assistant';

const schema = z.object({
  text: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(8).default([]),
});

export const POST = wsRoute('read', async ({ req, user, wid, workspace }) => {
  if (!rateLimit(`assistant:${user.id}`, 60, 60 * 60_000).ok) throw new ApiError(429, 'Too many questions. Try again later.');
  const { text, history } = schema.parse(await readJson(req));
  const ctx = { wid, user, workspace, text, history };
  if (aiEnabled && rateLimit(`assistant-ai:${user.id}`, AI_DAILY_LIMIT, 24 * 3600_000).ok) {
    try {
      return { ...(await answerWithAI(ctx)), source: 'ai' };
    } catch (err) {
      console.error('[assistant] AI failed, using built-in answers:', err?.message);
    }
  }
  return { ...(await answerWithRules(ctx)), source: 'built-in' };
});
