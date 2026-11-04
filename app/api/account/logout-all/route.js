import { route } from '@/lib/api';
import { User } from '@/models';

export const POST = route(async ({ user }) => {
  await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
  return { ok: true };
});
