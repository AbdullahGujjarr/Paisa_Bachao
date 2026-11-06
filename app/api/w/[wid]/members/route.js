import { wsRoute } from '@/lib/api';
import { ActivityLog, WorkspaceMember } from '@/models';

export const GET = wsRoute('read', async ({ wid }) => {
  const members = await WorkspaceMember.find({ workspace: wid }).populate('user', 'name email image').sort({ createdAt: 1 }).lean();
  const last = await ActivityLog.aggregate([
    { $match: { workspace: members[0]?.workspace } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$user', at: { $first: '$createdAt' }, summary: { $first: '$summary' } } },
  ]);
  return members
    .filter((m) => m.user)
    .map((m) => ({
      id: String(m.user._id),
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      lastActivity: last.find((l) => String(l._id) === String(m.user._id)) || null,
    }));
});
