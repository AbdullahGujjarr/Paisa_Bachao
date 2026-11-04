import { wsRoute, assertId } from '@/lib/api';
import { Invitation } from '@/models';

export const DELETE = wsRoute('manage', async ({ params, wid }) => {
  await Invitation.updateOne({ _id: assertId(params.id), workspace: wid }, { status: 'revoked' });
  return { ok: true };
});
