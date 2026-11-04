import crypto from 'node:crypto';
import { publicRoute, ApiError } from '@/lib/api';
import { runJobs } from '@/lib/jobs';

export const POST = publicRoute(async ({ req }) => {
  const expected = crypto.createHash('sha256').update(`cron:${process.env.AUTH_SECRET}`).digest();
  const given = Buffer.from(req.headers.get('x-cron-secret') || '', 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new ApiError(404, 'Not found.');
  return runJobs();
});
