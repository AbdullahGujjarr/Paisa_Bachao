import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { wsRoute, ApiError } from '@/lib/api';
import { Transaction } from '@/models';

export const GET = wsRoute('read', async ({ req, wid, user }) => {
  const month = new URL(req.url).searchParams.get('month') || DateTime.now().toFormat('yyyy-MM');
  const start = DateTime.fromFormat(month, 'yyyy-MM', { zone: user.timezone });
  if (!start.isValid) throw new ApiError(400, 'Invalid month.');
  const rows = await Transaction.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(wid), date: { $gte: start.toJSDate(), $lte: start.endOf('month').toJSDate() } } },
    { $group: { _id: { d: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: user.timezone } }, t: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const days = {};
  for (const r of rows) {
    days[r._id.d] ||= { income: 0, expense: 0, count: 0 };
    days[r._id.d][r._id.t] = r.total;
    days[r._id.d].count += r.count;
  }
  return { month, days };
});
