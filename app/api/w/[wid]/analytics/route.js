import { wsRoute } from '@/lib/api';
import { analytics, compareMonths } from '@/lib/analytics';

export const GET = wsRoute('read', async ({ req, wid, user, workspace }) => {
  const sp = new URL(req.url).searchParams;
  const [data, months] = await Promise.all([
    analytics(wid, { preset: sp.get('preset') || 'month', from: sp.get('from'), to: sp.get('to'), tz: user.timezone, currency: workspace.currency }),
    compareMonths(wid, user.timezone),
  ]);
  return { ...data, months };
});
