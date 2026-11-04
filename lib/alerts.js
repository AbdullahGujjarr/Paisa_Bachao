import { Budget, Notification, WorkspaceMember } from '@/models';
import { budgetSpent } from './analytics';
import { newThresholds, round2 } from './finance';
import { notifyUser } from './realtime';

export async function notify(userId, data) {
  try {
    await Notification.create({ user: userId, ...data });
    notifyUser(userId, 'notification', { title: data.title, body: data.body });
  } catch (err) {
    if (err?.code !== 11000) throw err; // A duplicate means this reminder was already sent.
  }
}

export async function notifyMembers(wid, { title, body, link, kind, dedupeKey }) {
  const members = await WorkspaceMember.find({ workspace: wid }).select('user').lean();
  await Promise.all(members.map((m) => notify(m.user, { workspace: wid, title, body, link, kind, dedupeKey })));
}

/** Sends the 50/75/90/over-budget alerts for budgets that cover a transaction's date. */
export async function checkBudgetAlerts(wid, date) {
  const budgets = await Budget.find({ workspace: wid, startDate: { $lte: date }, endDate: { $gte: date } }).lean();
  await Promise.all(
    budgets.map(async (b) => {
      const spent = await budgetSpent(b);
      const percent = b.amount > 0 ? round2((spent / b.amount) * 100) : 0;
      const crossed = newThresholds(percent, b.alerted);
      if (!crossed.length) return;
      const top = Math.max(...crossed);
      await Budget.updateOne({ _id: b._id }, { $addToSet: { alerted: { $each: crossed } } });
      await notifyMembers(wid, {
        kind: top === 100 ? 'danger' : 'warning',
        title: top === 100 ? `${b.name} is over budget` : `${b.name}: ${top}% used`,
        body: top === 100 ? `You have spent ${Math.round(percent)}% of this budget.` : `${Math.round(percent)}% of this budget is used so far.`,
        link: '/budgets',
      });
    }),
  );
}
