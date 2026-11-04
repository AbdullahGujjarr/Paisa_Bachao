import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { Transaction, Budget, Wallet } from '@/models';
import { budgetStatus, buildInsights, detectUnusual, forecastMonth, oneOffTotal, pctChange, round2, safeDailySpend } from './finance';
import { money } from './format';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

export function rangeFor(preset, tz, fromStr, toStr) {
  const now = DateTime.now().setZone(tz);
  const custom = (v) => DateTime.fromISO(v, { zone: tz });
  switch (preset) {
    case 'day':
      return { from: now.startOf('day'), to: now.endOf('day'), bucket: 'hour' };
    case 'week':
      return { from: now.startOf('week'), to: now.endOf('week'), bucket: 'day' };
    case 'year':
      return { from: now.startOf('year'), to: now.endOf('year'), bucket: 'month' };
    case 'custom': {
      const from = custom(fromStr).startOf('day');
      const to = custom(toStr).endOf('day');
      if (!from.isValid || !to.isValid || to < from) return rangeFor('month', tz);
      const days = to.diff(from, 'days').days;
      return { from, to, bucket: days > 120 ? 'month' : days > 45 ? 'week' : 'day' };
    }
    default:
      return { from: now.startOf('month'), to: now.endOf('month'), bucket: 'day' };
  }
}

const inRange = (wid, from, to) => ({ workspace: oid(wid), date: { $gte: from.toJSDate(), $lte: to.toJSDate() } });

export async function totals(wid, from, to) {
  const rows = await Transaction.aggregate([
    { $match: inRange(wid, from, to) },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const get = (t) => rows.find((r) => r._id === t) || { total: 0, count: 0 };
  return { income: round2(get('income').total), expense: round2(get('expense').total), count: get('income').count + get('expense').count };
}

export async function byCategory(wid, from, to, type = 'expense') {
  const rows = await Transaction.aggregate([
    { $match: { ...inRange(wid, from, to), type } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({
    id: r._id,
    name: r.cat[0]?.name || 'Uncategorised',
    color: r.cat[0]?.color || '#6b7280',
    icon: r.cat[0]?.icon || 'Tag',
    total: round2(r.total),
    count: r.count,
  }));
}

async function series(wid, from, to, bucket, tz) {
  const rows = await Transaction.aggregate([
    { $match: inRange(wid, from, to) },
    {
      $group: {
        _id: { b: { $dateTrunc: { date: '$date', unit: bucket, timezone: tz } }, t: '$type' },
        total: { $sum: '$amount' },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    const key = DateTime.fromJSDate(r._id.b).setZone(tz).toMillis();
    const entry = map.get(key) || { income: 0, expense: 0 };
    entry[r._id.t] = r.total;
    map.set(key, entry);
  }
  const label = { hour: 'HH:00', day: 'dd MMM', week: "'Wk' dd MMM", month: 'MMM yy' }[bucket];
  const points = [];
  let cursor = from.startOf(bucket);
  let cumulative = 0;
  // Stop at today, so days that have not happened do not read as zero spending.
  const latest = Math.max(Date.now(), ...map.keys());
  const stop = Math.min(to.toMillis(), latest);
  while (cursor.toMillis() <= stop) {
    const v = map.get(cursor.toMillis()) || { income: 0, expense: 0 };
    cumulative += v.income - v.expense;
    points.push({
      label: cursor.toFormat(label),
      date: cursor.toISODate(),
      income: round2(v.income),
      expense: round2(v.expense),
      net: round2(v.income - v.expense),
      savings: round2(cumulative),
    });
    cursor = cursor.plus({ [bucket]: 1 });
  }
  return points;
}

async function dayExtremes(wid, from, to, tz) {
  const rows = await Transaction.aggregate([
    { $match: { ...inRange(wid, from, to), type: 'expense' } },
    { $group: { _id: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: tz } }, total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  if (!rows.length) return { highest: null, lowest: null };
  const day = (r) => ({ date: r._id, total: round2(r.total) });
  return { highest: day(rows[0]), lowest: day(rows[rows.length - 1]) };
}

/** Everything the Analytics screen shows, always computed from the workspace's real transactions. */
export async function analytics(wid, { preset, from: fromStr, to: toStr, tz, currency }) {
  const { from, to, bucket } = rangeFor(preset, tz, fromStr, toStr);
  const span = to.diff(from).toMillis();
  const prevTo = from.minus({ milliseconds: 1 });
  const prevFrom = prevTo.minus({ milliseconds: span });

  const [t, prevT, categories, prevCategories, points, extremes, largest] = await Promise.all([
    totals(wid, from, to),
    totals(wid, prevFrom, prevTo),
    byCategory(wid, from, to),
    byCategory(wid, prevFrom, prevTo),
    series(wid, from, to, bucket, tz),
    dayExtremes(wid, from, to, tz),
    Transaction.findOne({ ...inRange(wid, from, to), type: 'expense' }).sort({ amount: -1 }).select('name amount date').lean(),
  ]);

  // Averages divide by days that have actually happened, not the whole period.
  const now = DateTime.now().setZone(tz);
  const end = now < to ? now : to;
  const daysElapsed = Math.max(1, Math.ceil(end.diff(from, 'days').days));
  const avgDaily = round2(t.expense / daysElapsed);
  const mostFrequent = [...categories].sort((a, b) => b.count - a.count)[0] || null;

  return {
    range: { from: from.toISO(), to: to.toISO(), bucket },
    totals: t,
    previous: prevT,
    series: points,
    categories,
    stats: {
      avgDaily,
      avgWeekly: round2(avgDaily * 7),
      avgMonthly: round2(avgDaily * 30.44),
      highestDay: extremes.highest,
      lowestDay: extremes.lowest,
      topCategory: categories[0] || null,
      mostFrequent,
      largest,
      savings: round2(t.income - t.expense),
      savingsRate: t.income > 0 ? round2(((t.income - t.expense) / t.income) * 100) : null,
      incomeToExpense: t.expense > 0 ? round2(t.income / t.expense) : null,
      expenseChange: pctChange(t.expense, prevT.expense),
      incomeChange: pctChange(t.income, prevT.income),
    },
    insights: buildInsights({
      categories,
      previousCategories: prevCategories,
      avgDaily,
      expense: t.expense,
      previousExpense: prevT.expense,
      fmt: (n) => money(n, currency),
    }),
  };
}

/** Month-by-month totals for the comparison chart. */
export async function compareMonths(wid, tz, months = 12) {
  const now = DateTime.now().setZone(tz);
  const from = now.minus({ months: months - 1 }).startOf('month');
  return series(wid, from, now.endOf('month'), 'month', tz);
}

/** Amount spent against a budget: tagged directly, or matching its categories and dates. */
export async function budgetSpent(budget) {
  const untagged = {
    budget: null,
    date: { $gte: budget.startDate, $lte: budget.endDate },
    ...(budget.categories?.length ? { category: { $in: budget.categories.map(oid) } } : {}),
  };
  const rows = await Transaction.aggregate([
    { $match: { workspace: oid(budget.workspace), type: 'expense', $or: [{ budget: oid(budget._id) }, untagged] } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total || 0;
}

export async function budgetsWithStatus(wid, filter = {}) {
  const budgets = await Budget.find({ workspace: wid, ...filter }).sort({ endDate: -1 }).lean();
  return Promise.all(
    budgets.map(async (b) => ({ ...b, ...budgetStatus({ ...b, spent: await budgetSpent(b) }) })),
  );
}

export async function walletBalances(wid) {
  const [wallets, rows] = await Promise.all([
    Wallet.find({ workspace: wid }).sort({ createdAt: 1 }).lean(),
    Transaction.aggregate([
      { $match: { workspace: oid(wid) } },
      { $group: { _id: { w: '$wallet', t: '$type' }, total: { $sum: '$amount' } } },
    ]),
  ]);
  const sum = (id, type) => rows.find((r) => String(r._id.w) === String(id) && r._id.t === type)?.total || 0;
  return wallets.map((w) => ({ ...w, balance: round2(w.openingBalance + sum(w._id, 'income') - sum(w._id, 'expense')) }));
}

/** The dashboard in one call: overview, forecast, safe spending, unusual activity and insights. */
export async function summary(wid, { tz, currency }) {
  const now = DateTime.now().setZone(tz);
  const monthStart = now.startOf('month');
  const monthEnd = now.endOf('month');
  const history = [1, 2, 3].map((i) => {
    const m = now.minus({ months: i });
    return { from: m.startOf('month'), to: m.endOf('month') };
  });

  const [month, wallets, allTime, categories, budgets, recent, pastCats, lastMonth, monthExpenses] = await Promise.all([
    totals(wid, monthStart, monthEnd),
    walletBalances(wid),
    Transaction.aggregate([{ $match: { workspace: oid(wid) } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
    byCategory(wid, monthStart, monthEnd),
    budgetsWithStatus(wid, { endDate: { $gte: now.startOf('day').toJSDate() }, startDate: { $lte: now.toJSDate() } }),
    Transaction.find({ workspace: wid }).sort({ date: -1, createdAt: -1 }).limit(8).populate('category', 'name color icon').populate('createdBy', 'name image').lean(),
    Promise.all(history.map((h) => byCategory(wid, h.from, h.to))),
    totals(wid, history[0].from, history[0].to),
    Transaction.find({ ...inRange(wid, monthStart, monthEnd), type: 'expense' }).select('amount').lean(),
  ]);

  const income = allTime.find((r) => r._id === 'income')?.total || 0;
  const expense = allTime.find((r) => r._id === 'expense')?.total || 0;
  const opening = wallets.reduce((s, w) => s + w.openingBalance, 0);
  const balance = round2(opening + income - expense);

  const daysLeft = Math.max(1, Math.ceil(monthEnd.diff(now, 'days').days));
  const forecast = forecastMonth({
    spentSoFar: month.expense,
    dayOfMonth: now.day,
    daysInMonth: now.daysInMonth,
    oneOff: oneOffTotal(monthExpenses.map((t) => t.amount)),
  });
  const activeBudgetLeft = budgets.length ? budgets.reduce((s, b) => s + Math.max(0, b.remaining), 0) : null;
  const toMap = (rows) => Object.fromEntries(rows.map((c) => [c.name, c.total]));
  const pastMonths = pastCats.filter((rows) => rows.length);
  const unusual = detectUnusual({
    current: toMap(categories),
    history: pastMonths.map(toMap),
    counts: pastMonths.map((rows) => Object.fromEntries(rows.map((c) => [c.name, c.count]))),
    monthProgress: now.day / now.daysInMonth,
  });

  return {
    balance,
    month,
    lastMonth,
    wallets,
    categories,
    budgets: budgets.slice(0, 4),
    recent,
    forecast,
    safeDaily: safeDailySpend({ available: activeBudgetLeft ?? month.income - month.expense, daysLeft }),
    safeDailyBasis: activeBudgetLeft !== null ? 'budgets' : 'income',
    daysLeft,
    unusual,
    insights: buildInsights({
      categories,
      previousCategories: pastCats[0],
      avgDaily: round2(month.expense / Math.max(1, now.day)),
      expense: month.expense,
      previousExpense: lastMonth.expense,
      fmt: (n) => money(n, currency),
    }),
  };
}
