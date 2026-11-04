import { wsRoute, readJson, assertId, ApiError } from '@/lib/api';
import { memberSchema } from '@/lib/schemas';
import { dropFromRoom, logAndBroadcast, notifyUser } from '@/lib/realtime';
import { Workspace, WorkspaceMember } from '@/models';

export const PATCH = wsRoute('manage', async ({ req, user, params, wid }) => {
  const uid = assertId(params.uid);
  const data = memberSchema.parse(await readJson(req));
  const target = await WorkspaceMember.findOne({ workspace: wid, user: uid }).populate('user', 'name');
  if (!target) throw new ApiError(404, 'Member not found.');
  if (target.role === 'owner') throw new ApiError(400, "The owner's access cannot be changed.");
  Object.assign(target, data);
  await target.save();
  await logAndBroadcast({ wid, user, action: 'updated', entity: 'member', entityId: uid, summary: `${user.name} changed ${target.user.name}'s permissions` });
  notifyUser(uid, 'membership', { workspaceId: wid });
  return { ok: true };
});

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
