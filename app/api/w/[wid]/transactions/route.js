import { wsRoute, readJson } from '@/lib/api';
import { transactionSchema } from '@/lib/schemas';
import { assertRefs } from '@/lib/crud';
import { checkBudgetAlerts } from '@/lib/alerts';
import { logAndBroadcast } from '@/lib/realtime';
import { money } from '@/lib/format';
import { round2 } from '@/lib/finance';
import { buildFilter } from '@/lib/txFilter';
import { Transaction } from '@/models';

export const GET = wsRoute('read', async ({ req, wid }) => {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 30));
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const filter = buildFilter(wid, sp);
  const [items, sums] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name color icon')
      .populate('wallet', 'name')
      .populate('createdBy', 'name image')
      .populate('updatedBy', 'name')
      .populate('paidBy', 'name')
      .lean(),
    Transaction.aggregate([{ $match: filter }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  const sum = (t) => sums.find((s) => s._id === t) || { total: 0, count: 0 };
  const total = sum('income').count + sum('expense').count;
  return { items, total, page, hasMore: page * limit < total, income: round2(sum('income').total), expense: round2(sum('expense').total) };
});

export const POST = wsRoute('add', async ({ req, user, wid, workspace }) => {
  const data = transactionSchema.parse(await readJson(req));
  await assertRefs(wid, data);
  const tx = await Transaction.create({ ...data, workspace: wid, createdBy: user._id, paidBy: data.paidBy || user._id });
  await checkBudgetAlerts(wid, tx.date);
  await logAndBroadcast({
    wid,
    user,
    action: 'added',
    entity: 'transaction',
    entityId: tx._id,
    summary: `${user.name} added ${tx.name} (${money(tx.amount, workspace.currency)})`,
  });
  return tx;
});
