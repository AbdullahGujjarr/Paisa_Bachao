import { route, readJson, ApiError } from '@/lib/api';
import { hashToken } from '@/lib/tokens';
import { logAndBroadcast } from '@/lib/realtime';
import { MAX_MEMBERS } from '@/lib/workspace';
import { Invitation, Workspace, WorkspaceMember } from '@/models';

async function load(token) {
  const invite = await Invitation.findOne({ tokenHash: hashToken(token) }).populate('workspace', 'name memberCount').populate('invitedBy', 'name');
  if (!invite || !invite.workspace || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    throw new ApiError(404, 'This invitation is no longer valid.');
  }
  return invite;
}

export const GET = route(async ({ params, user }) => {
  const invite = await load(params.token);
  return {
    workspace: invite.workspace.name,
    invitedBy: invite.invitedBy?.name,
    role: invite.role,
    memberCount: invite.workspace.memberCount,
    isFull: invite.workspace.memberCount >= MAX_MEMBERS,
    alreadyMember: Boolean(await WorkspaceMember.exists({ workspace: invite.workspace._id, user: user._id })),
    workspaceId: String(invite.workspace._id),
  };
});

export const POST = route(async ({ req, params, user }) => {
  const { accept } = await readJson(req);
  const invite = await load(params.token);
  if (invite.email && invite.email !== user.email) throw new ApiError(403, `This invitation was sent to ${invite.email}.`);
  const wid = invite.workspace._id;
  if (!accept) {
    if (invite.email) {
      invite.status = 'rejected';
      await invite.save();
    }
    return { ok: true };
  }
  if (await WorkspaceMember.exists({ workspace: wid, user: user._id })) throw new ApiError(409, 'You are already a member.');
  // The conditional update is the seat reservation, so simultaneous accepts cannot pass the limit.
  const seat = await Workspace.updateOne({ _id: wid, memberCount: { $lt: MAX_MEMBERS } }, { $inc: { memberCount: 1 } });
  if (!seat.modifiedCount) throw new ApiError(409, `This workspace already has ${MAX_MEMBERS} members.`);
  try {
    await WorkspaceMember.create({ workspace: wid, user: user._id, role: invite.role });
  } catch (err) {
    await Workspace.updateOne({ _id: wid }, { $inc: { memberCount: -1 } });
    throw err;
  }
  // Open links stay usable for the other seats. Email invites are single-use.
  if (invite.email) {
    invite.status = 'accepted';
    await invite.save();
  }
  await logAndBroadcast({ wid, user, action: 'joined', entity: 'member', entityId: user._id, summary: `${user.name} joined the workspace` });
  return { workspaceId: String(wid) };
});
