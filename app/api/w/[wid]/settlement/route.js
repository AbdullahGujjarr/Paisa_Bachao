import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { wsRoute, readJson, ApiError } from '@/lib/api';
import { computeSettlement } from '@/lib/finance';
import { settlementSchema } from '@/lib/schemas';
import { logAndBroadcast } from '@/lib/realtime';
import { money } from '@/lib/format';
import { Settlement, Transaction, WorkspaceMember } from '@/models';

export const GET = wsRoute('read', async ({ req, wid, user }) => {
  const month = new URL(req.url).searchParams.get('month') || DateTime.now().setZone(user.timezone).toFormat('yyyy-MM');
  const start = DateTime.fromFormat(month, 'yyyy-MM', { zone: user.timezone });
  if (!start.isValid) throw new ApiError(400, 'Invalid month.');
  const range = { $gte: start.toJSDate(), $lte: start.endOf('month').toJSDate() };
  const [members, rows, settlements] = await Promise.all([
    WorkspaceMember.find({ workspace: wid }).populate('user', 'name image').lean(),
    Transaction.aggregate([
      { $match: { workspace: new mongoose.Types.ObjectId(wid), type: 'expense', date: range } },
      { $group: { _id: { $ifNull: ['$paidBy', '$createdBy'] }, total: { $sum: '$amount' } } },
    ]),
    Settlement.find({ workspace: wid, date: range }).sort({ date: -1 }).lean(),
  ]);
  const people = members.filter((m) => m.user);
  const result = computeSettlement({
    members: people.map((m) => String(m.user._id)),
    paid: Object.fromEntries(rows.map((r) => [String(r._id), r.total])),
    settlements,
  });
  const profiles = Object.fromEntries(people.map((m) => [String(m.user._id), { name: m.user.name, image: m.user.image }]));
  return { month, ...result, profiles, settlements };
});

export const POST = wsRoute('add', async ({ req, user, wid, workspace }) => {
  const data = settlementSchema.parse(await readJson(req));
  const count = await WorkspaceMember.countDocuments({ workspace: wid, user: { $in: [data.from, data.to] } });
  if (count !== 2 || data.from === data.to) throw new ApiError(422, 'Both people must be different members of this workspace.');
  const doc = await Settlement.create({ ...data, workspace: wid, createdBy: user._id });
  await logAndBroadcast({ wid, user, action: 'added', entity: 'settlement', entityId: doc._id, summary: `${user.name} recorded a settlement of ${money(doc.amount, workspace.currency)}` });
  return doc;
});
