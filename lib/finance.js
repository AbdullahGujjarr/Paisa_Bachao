// Pure financial calculations with no database access, so they can be unit tested directly.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Percentage change from previous to current, or null when there is no baseline. */
export function pctChange(current, previous) {
  if (!previous) return null;
  return round2(((current - previous) / previous) * 100);
}

/** Where a budget stands: spent, remaining, days left and what can be spent per day. */
export function budgetStatus({ amount, spent, startDate, endDate, now = new Date() }) {
  const dayMs = 86400000;
  const end = new Date(endDate).getTime();
  const start = new Date(startDate).getTime();
  const remaining = round2(amount - spent);
  const daysLeft = now.getTime() > end ? 0 : Math.max(1, Math.ceil((end - Math.max(now.getTime(), start)) / dayMs));
  const totalDays = Math.max(1, Math.ceil((end - start) / dayMs));
  const elapsed = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - start) / dayMs)));
  return {
    spent: round2(spent),
    remaining,
    percent: amount > 0 ? round2((spent / amount) * 100) : 0,
    daysLeft,
    dailyAllowance: daysLeft > 0 ? round2(Math.max(0, remaining) / daysLeft) : 0,
    plannedToDate: round2((amount * elapsed) / totalDays),
    status: spent > amount ? 'over' : spent >= amount * 0.9 ? 'danger' : spent >= amount * 0.75 ? 'warning' : 'ok',
  };
}

/** Alert thresholds newly crossed by a budget, given the ones already sent. */
export function newThresholds(percent, alerted = []) {
  return [50, 75, 90, 100].filter((t) => (t === 100 ? percent > 100 : percent >= t) && !alerted.includes(t));
}

/** Sum of amounts far above the typical one, such as rent. These happen once, not daily. */
export function oneOffTotal(amounts) {
  if (amounts.length < 3) return 0;
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return sorted.filter((a) => a >= median * 5).reduce((s, a) => s + a, 0);
}

/** Projects month-end spending. One-off amounts count once and are kept out of the daily pace. */
export function forecastMonth({ spentSoFar, dayOfMonth, daysInMonth, oneOff = 0 }) {
  if (dayOfMonth < 1 || spentSoFar <= 0) return { projected: round2(spentSoFar), dailyPace: 0, reliable: false };
  const dailyPace = (spentSoFar - oneOff) / dayOfMonth;
  return {
    projected: round2(spentSoFar + dailyPace * (daysInMonth - dayOfMonth)),
    dailyPace: round2(dailyPace),
    // A pace from the first few days of a month swings too much to act on.
    reliable: dayOfMonth >= 5,
  };
}

/** What can be spent per day until month end without going over the money available. */
export function safeDailySpend({ available, daysLeft }) {
  if (daysLeft <= 0) return 0;
  return round2(Math.max(0, available) / daysLeft);
}

/**
 * Flags categories running well above their usual level. Everyday categories are compared
 * against their average scaled to how much of the month has passed. Categories paid only once
 * or twice a month, like rent, are compared against the full month, since paying early is normal.
 */
export function detectUnusual({ current, history, counts = [], monthProgress }) {
  const out = [];
  for (const [category, spent] of Object.entries(current)) {
    const past = history.map((m) => m[category] || 0);
    if (past.length < 2) continue;
    const avg = past.reduce((a, b) => a + b, 0) / past.length;
    if (avg <= 0) continue;
    const avgCount = counts.length ? counts.reduce((s, m) => s + (m[category] || 0), 0) / counts.length : Infinity;
    const expected = avgCount >= 4 ? avg * Math.max(monthProgress, 0.25) : avg;
    if (spent > expected * 1.5 && spent - expected > avg * 0.2) {
      out.push({ category, spent: round2(spent), expected: round2(expected), ratio: round2(spent / expected) });
    }
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Equal-split settlement. Takes what each member paid plus settlements already made, and
 * returns each balance and the fewest transfers that bring everyone to zero.
 */
export function computeSettlement({ members, paid, settlements = [] }) {
  const ids = members.map(String);
  const total = ids.reduce((sum, id) => sum + (paid[id] || 0), 0);
  const share = ids.length ? total / ids.length : 0;
  const balance = Object.fromEntries(ids.map((id) => [id, (paid[id] || 0) - share]));
  for (const s of settlements) {
    const from = String(s.from);
    const to = String(s.to);
    if (from in balance) balance[from] += s.amount;
    if (to in balance) balance[to] -= s.amount;
  }
  const creditors = ids.filter((id) => balance[id] > 0.005).map((id) => ({ id, left: balance[id] })).sort((a, b) => b.left - a.left);
  const debtors = ids.filter((id) => balance[id] < -0.005).map((id) => ({ id, left: -balance[id] })).sort((a, b) => b.left - a.left);
  const transfers = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].left, debtors[d].left);
    if (amount > 0.005) transfers.push({ from: debtors[d].id, to: creditors[c].id, amount: round2(amount) });
    creditors[c].left -= amount;
    debtors[d].left -= amount;
    if (creditors[c].left <= 0.005) c += 1;
    if (debtors[d].left <= 0.005) d += 1;
  }
  return {
    total: round2(total),
    share: round2(share),
    balances: ids.map((id) => ({ id, paid: round2(paid[id] || 0), balance: round2(balance[id]) })),
    transfers,
  };
}

/** Plain-language insights. Every sentence is derived from the numbers passed in. */
export function buildInsights({ categories, previousCategories, avgDaily, expense, previousExpense, fmt }) {
  const insights = [];
  const prev = new Map(previousCategories.map((c) => [c.name, c.total]));
  const movers = categories
    .map((c) => ({ ...c, change: pctChange(c.total, prev.get(c.name)) }))
    .filter((c) => c.change !== null && Math.abs(c.change) >= 10)
    .sort((a, b) => Math.abs(b.total - (prev.get(b.name) || 0)) - Math.abs(a.total - (prev.get(a.name) || 0)));
  for (const c of movers.slice(0, 2)) {
    insights.push({
      tone: c.change > 0 ? 'warn' : 'good',
      text: `You spent ${Math.abs(Math.round(c.change))}% ${c.change > 0 ? 'more' : 'less'} on ${c.name} than in the previous period.`,
    });
  }
  const ordinals = ['highest', 'second-highest', 'third-highest'];
  categories.slice(0, 3).forEach((c, i) => {
    if (i === 0 || i === 2) insights.push({ tone: 'info', text: `${c.name} is your ${ordinals[i]} spending category at ${fmt(c.total)}.` });
  });
  if (avgDaily > 0) insights.push({ tone: 'info', text: `Your average daily spending is ${fmt(avgDaily)}.` });
  const change = pctChange(expense, previousExpense);
  if (change !== null && Math.abs(change) >= 5) {
    insights.push({
      tone: change > 0 ? 'warn' : 'good',
      text: `Total spending is ${change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))}% on the previous period.`,
    });
  }
  return insights;
}
