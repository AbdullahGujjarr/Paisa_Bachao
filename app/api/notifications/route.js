import { route, readJson, isId } from '@/lib/api';
import { Notification } from '@/models';

export const GET = route(async ({ user }) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(40).lean(),
    Notification.countDocuments({ user: user._id, read: false }),
  ]);
  return { items, unread };
});

export const PATCH = route(async ({ req, user }) => {
  const { id } = await readJson(req);
  const filter = { user: user._id, ...(isId(id) ? { _id: id } : {}) };
  await Notification.updateMany(filter, { read: true });
  return { ok: true };
});
