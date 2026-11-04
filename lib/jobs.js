import { DateTime } from 'luxon';
import { Debt, RecurringTransaction, Subscription, Transaction, Workspace } from '@/models';
import { checkBudgetAlerts, notifyMembers } from './alerts';
import { broadcast } from './realtime';

const STEP = { daily: { days: 1 }, weekly: { weeks: 1 }, monthly: { months: 1 }, yearly: { years: 1 } };

export function nextDate(date, frequency) {
  return DateTime.fromJSDate(new Date(date), { zone: 'utc' }).plus(STEP[frequency]).toJSDate();
}

async function postRecurring(now) {
  const due = await RecurringTransaction.find({ active: true, nextRun: { $lte: now } });
  let posted = 0;
  for (const rule of due) {
    const ws = await Workspace.findById(rule.workspace).select('owner').lean();
    if (!ws) continue;
    let run = rule.nextRun;
    // The cap stops a very old rule from flooding the Cash Book in one pass.
    for (let i = 0; i < 400 && run <= now; i += 1) {
      if (rule.endDate && run > rule.endDate) break;
      try {
        await Transaction.create({
          workspace: rule.workspace,
          type: rule.type,
          name: rule.name,
          amount: rule.amount,
          category: rule.category,
          wallet: rule.wallet,
          paymentMethod: rule.paymentMethod,
          date: run,
          recurring: rule._id,
          createdBy: rule.createdBy || ws.owner,
          paidBy: rule.createdBy || ws.owner,
        });
        posted += 1;
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
      run = nextDate(run, rule.frequency);
    }
    rule.nextRun = run;
    if (rule.endDate && run > rule.endDate) rule.active = false;
    await rule.save();
    await checkBudgetAlerts(rule.workspace, now);
    broadcast(rule.workspace, { entity: 'transaction', action: 'recurring' });
  }
  return posted;
}

async function remind(now) {
  const subs = await Subscription.find({ active: true }).lean();
  for (const s of subs) {
    const notifyFrom = DateTime.fromJSDate(s.nextPayment).minus({ days: s.remindDays }).toJSDate();
    if (now < notifyFrom) continue;
    await notifyMembers(s.workspace, {
      kind: 'reminder',
      title: `${s.name} payment is coming up`,
      body: `Due ${DateTime.fromJSDate(s.nextPayment).toFormat('dd MMM')}.`,
      link: '/subscriptions',
      dedupeKey: `sub:${s._id}:${s.nextPayment.getTime()}`,
    });
  }
  const soon = DateTime.fromJSDate(now).plus({ days: 3 }).toJSDate();
  const debts = await Debt.find({ dueDate: { $ne: null, $lte: soon }, $expr: { $lt: ['$paid', '$amount'] } }).lean();
  for (const d of debts) {
    await notifyMembers(d.workspace, {
      kind: 'reminder',
      title: d.direction === 'lent' ? `${d.person} owes you money` : `Repayment due to ${d.person}`,
      body: `Due ${DateTime.fromJSDate(d.dueDate).toFormat('dd MMM')}.`,
      link: '/debts',
      dedupeKey: `debt:${d._id}:${d.dueDate.getTime()}`,
    });
  }
}

export async function runJobs(now = new Date()) {
  const posted = await postRecurring(now);
  await remind(now);
  return { posted };
}
