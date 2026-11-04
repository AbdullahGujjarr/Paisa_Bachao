import { z } from 'zod';
import { route, readJson, ApiError } from '@/lib/api';
import { createWorkspace } from '@/lib/workspace';
import { Workspace } from '@/models';

const schema = z.object({ name: z.string().trim().min(1).max(60), currency: z.string().regex(/^[A-Z]{3}$/).optional() });

export const POST = route(async ({ req, user }) => {
  const data = schema.parse(await readJson(req));
  if ((await Workspace.countDocuments({ owner: user._id, type: 'shared' })) >= 20) throw new ApiError(400, 'You have reached the limit of 20 shared workspaces.');
  const ws = await createWorkspace({ ...data, type: 'shared', owner: user });
  return { id: String(ws._id) };
});
