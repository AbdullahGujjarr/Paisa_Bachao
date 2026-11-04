import { wsRoute } from '@/lib/api';
import { summary } from '@/lib/analytics';

export const GET = wsRoute('read', async ({ wid, user, workspace }) => summary(wid, { tz: user.timezone, currency: workspace.currency }));
