import { wsRoute, readJson, assertId, ApiError } from '@/lib/api';
import { transactionSchema } from '@/lib/schemas';
import { assertRefs } from '@/lib/crud';
import { checkBudgetAlerts } from '@/lib/alerts';
import { logAndBroadcast } from '@/lib/realtime';
import { money } from '@/lib/format';
import { Transaction } from '@/models';

const find = async (wid, id) => {
  const tx = await Transaction.findOne({ _id: assertId(id), workspace: wid });
  if (!tx) throw new ApiError(404, 'Transaction not found.');
  return tx;
};

export const GET = wsRoute('read', async ({ params, wid }) => find(wid, params.id));

export const PATCH = wsRoute('edit', async ({ req, user, params, wid, workspace }) => {
  const tx = await find(wid, params.id);
  const data = transactionSchema.parse({ ...JSON.parse(JSON.stringify(tx)), ...(await readJson(req)) });
  await assertRefs(wid, data);
  Object.assign(tx, data, { updatedBy: user._id });
  await tx.save();
  await checkBudgetAlerts(wid, tx.date);
  await logAndBroadcast({ wid, user, action: 'edited', entity: 'transaction', entityId: tx._id, summary: `${user.name} edited ${tx.name} (${money(tx.amount, workspace.currency)})` });
  return tx;
});

export const DELETE = wsRoute('delete', async ({ user, params, wid, workspace }) => {
  const tx = await find(wid, params.id);
  await tx.deleteOne();
  await logAndBroadcast({ wid, user, action: 'deleted', entity: 'transaction', entityId: tx._id, summary: `${user.name} deleted ${tx.name} (${money(tx.amount, workspace.currency)})` });
  return { ok: true };
});
