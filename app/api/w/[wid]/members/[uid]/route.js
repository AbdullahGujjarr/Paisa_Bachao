import { wsRoute, assertId, ApiError } from '@/lib/api';
import { dropFromRoom, logAndBroadcast } from '@/lib/realtime';
import { Workspace, WorkspaceMember } from '@/models';

// Owners can remove anyone else. Any other member can remove themselves, which is leaving.
export const DELETE = wsRoute('read', async ({ user, member, params, wid }) => {
  const uid = assertId(params.uid);
  const self = uid === user.id;
  if (!self && member.role !== 'owner') throw new ApiError(403, 'Only the owner can remove members.');
  const target = await WorkspaceMember.findOne({ workspace: wid, user: uid }).populate('user', 'name');
  if (!target) throw new ApiError(404, 'Member not found.');
  if (target.role === 'owner') throw new ApiError(400, 'The owner cannot leave. Delete the workspace instead.');
  await WorkspaceMember.deleteOne({ _id: target._id });
  await Workspace.updateOne({ _id: wid }, { $inc: { memberCount: -1 } });
  dropFromRoom(uid, wid);
  await logAndBroadcast({ wid, user, action: 'removed', entity: 'member', entityId: uid, summary: self ? `${user.name} left the workspace` : `${user.name} removed ${target.user.name}` });
  return { ok: true };
});
