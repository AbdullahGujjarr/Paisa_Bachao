import { z } from 'zod';
import { wsRoute, readJson, ApiError } from '@/lib/api';
import { deleteWorkspaceData } from '@/lib/account';
import { dropFromRoom, logAndBroadcast } from '@/lib/realtime';
import { Workspace, WorkspaceMember } from '@/models';

const schema = z.object({ name: z.string().trim().min(1).max(60).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional() });

export const PATCH = wsRoute('manage', async ({ req, user, wid }) => {
  const data = schema.parse(await readJson(req));
  await Workspace.updateOne({ _id: wid }, data);
  await logAndBroadcast({ wid, user, action: 'updated', entity: 'workspace', entityId: wid, summary: `${user.name} updated workspace settings` });
  return { ok: true };
});

export const DELETE = wsRoute('manage', async ({ wid, workspace }) => {
  if (workspace.type === 'personal') throw new ApiError(400, 'Your personal workspace cannot be deleted.');
  const members = await WorkspaceMember.find({ workspace: wid }).select('user').lean();
  await deleteWorkspaceData(wid);
  members.forEach((m) => dropFromRoom(m.user, wid));
  return { ok: true };
});
