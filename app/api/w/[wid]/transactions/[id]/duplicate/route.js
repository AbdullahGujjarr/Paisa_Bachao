import { wsRoute, assertId, ApiError } from '@/lib/api';
import { logAndBroadcast } from '@/lib/realtime';
import { checkBudgetAlerts } from '@/lib/alerts';
import { Transaction } from '@/models';

export const POST = wsRoute('add', async ({ user, params, wid }) => {
  const src = await Transaction.findOne({ _id: assertId(params.id), workspace: wid }).lean();
  if (!src) throw new ApiError(404, 'Transaction not found.');
  const { _id, createdAt, updatedAt, updatedBy, recurring, receiptScan, ...copy } = src;
  const tx = await Transaction.create({ ...copy, date: new Date(), createdBy: user._id });
  await checkBudgetAlerts(wid, tx.date);
  await logAndBroadcast({ wid, user, action: 'added', entity: 'transaction', entityId: tx._id, summary: `${user.name} duplicated ${tx.name}` });
  return tx;
});
