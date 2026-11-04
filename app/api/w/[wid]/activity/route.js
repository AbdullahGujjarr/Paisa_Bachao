import { wsRoute } from '@/lib/api';
import { ActivityLog } from '@/models';

export const GET = wsRoute('read', async ({ req, wid }) => {
  const page = Math.max(1, Number(new URL(req.url).searchParams.get('page')) || 1);
  const items = await ActivityLog.find({ workspace: wid }).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).populate('user', 'name image').lean();
  return { items, page };
});
