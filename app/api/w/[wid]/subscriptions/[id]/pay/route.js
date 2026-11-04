import { wsRoute, assertId, ApiError } from '@/lib/api';
import { logAndBroadcast } from '@/lib/realtime';
import { checkBudgetAlerts } from '@/lib/alerts';
import { nextDate } from '@/lib/jobs';
import { Subscription, Transaction } from '@/models';

const CYCLE = { weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' };

export const POST = wsRoute('add', async ({ user, params, wid }) => {
  const sub = await Subscription.findOne({ _id: assertId(params.id), workspace: wid });
  if (!sub) throw new ApiError(404, 'Subscription not found.');
  const tx = await Transaction.create({
    workspace: wid,
    type: 'expense',
    name: sub.name,
    amount: sub.amount,
    category: sub.category,
    date: new Date(),
    paymentMethod: 'card',
    tags: ['subscription'],
    createdBy: user._id,
    paidBy: user._id,
  });
  sub.nextPayment = nextDate(sub.nextPayment, CYCLE[sub.cycle]);
  await sub.save();
  await checkBudgetAlerts(wid, tx.date);
  await logAndBroadcast({ wid, user, action: 'added', entity: 'transaction', entityId: tx._id, summary: `${user.name} paid subscription ${sub.name}` });
  return sub;
});
