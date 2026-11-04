'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bot, Lightbulb, ScanLine, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useApp, useWs } from '@/components/AppProvider';
import { Button, Card, Empty, Progress, SectionTitle, Skeleton } from '@/components/ui';
import { CategoryBreakdown } from '@/components/charts';
import TxRow from '@/components/TxRow';
import TxDetail from '@/components/TxDetail';

function Stat({ label, value, sub }) {
  return (
    <Card className="!p-3.5 sm:!p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="num mt-1 truncate font-display text-xl font-extrabold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { fmt, openTx, perms, user, workspace } = useApp();
  const { data, isLoading } = useWs('summary');
  const [detail, setDetail] = useState(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const spentChange = data.lastMonth.expense > 0 ? Math.round(((data.month.expense - data.lastMonth.expense) / data.lastMonth.expense) * 100) : null;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-3">
      {user && !user.emailVerified && <VerifyBanner />}

      <section className="note rounded-3xl p-5 sm:p-7" style={{ '--note-radius': '1.5rem' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{workspace?.type === 'shared' ? workspace.name : `Salaam, ${firstName}`}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/70">Available balance</p>
            <p className="num mt-0.5 truncate font-display text-4xl font-extrabold sm:text-5xl">{fmt(data.balance)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/25 pt-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs text-white/75"><ArrowDownLeft size={14} aria-hidden /> Income this month</p>
            <p className="num truncate text-lg font-bold">{fmt(data.month.income)}</p>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs text-white/75"><ArrowUpRight size={14} aria-hidden /> Spent this month</p>
            <p className="num truncate text-lg font-bold">{fmt(data.month.expense)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {perms.add && <Button variant="soft" onClick={() => openTx({ type: 'expense' })} className="!px-2"><ArrowUpRight size={16} aria-hidden /> Expense</Button>}
        {perms.add && <Link href="/scan" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-soft px-2 text-sm font-semibold text-brand dark:text-ink"><ScanLine size={16} aria-hidden /> Scan</Link>}
        <Link href="/assistant" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-soft px-2 text-sm font-semibold text-brand dark:text-ink"><Bot size={16} aria-hidden /> Ask</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Safe to spend today" value={fmt(data.safeDaily)} sub={data.safeDailyBasis === 'budgets' ? `From budgets, ${data.daysLeft} days left` : `${data.daysLeft} days left this month`} />
        <Stat label="Month-end forecast" value={fmt(data.forecast.projected)} sub={data.forecast.reliable ? `At ${fmt(data.forecast.dailyPace)} a day` : 'Early estimate'} />
        <Stat label="Saved this month" value={fmt(data.month.income - data.month.expense)} sub={data.month.income > 0 ? `${Math.round(((data.month.income - data.month.expense) / data.month.income) * 100)}% of income` : 'No income yet'} />
        <Stat
          label="Against last month"
          value={spentChange === null ? 'No data' : `${spentChange > 0 ? '+' : ''}${spentChange}%`}
          sub={spentChange === null ? 'Nothing to compare yet' : spentChange > 0 ? 'Spending is up' : 'Spending is down'}
        />
      </div>

      {data.unusual.length > 0 && (
        <Card className="border-warn/40 !bg-warn-soft">
          <p className="flex items-center gap-2 text-sm font-bold text-warn"><AlertTriangle size={16} aria-hidden /> Unusual spending</p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.unusual.slice(0, 3).map((u) => (
              <li key={u.category}>{u.category}: {fmt(u.spent)} so far, against about {fmt(u.expected)} by this point in a normal month.</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle action={<Link href="/cashbook" className="text-sm font-semibold text-brand">See all</Link>}>Recent transactions</SectionTitle>
          {data.recent.length ? (
            <div className="-mx-1">{data.recent.map((t) => <TxRow key={t._id} tx={t} onClick={() => setDetail(t)} />)}</div>
          ) : (
            <Empty title="No transactions yet" text="Add your first income or expense, or scan a receipt." action={perms.add && <Button onClick={() => openTx({ type: 'expense' })}>Add transaction</Button>} />
          )}
        </Card>
        <div className="min-w-0 space-y-3">
          {data.categories.length > 0 && <CategoryBreakdown categories={data.categories} title="This month's spending" />}
          {data.insights.length > 0 && (
            <Card>
              <SectionTitle>Insights</SectionTitle>
              <ul className="space-y-2 text-sm">
                {data.insights.slice(0, 4).map((i) => (
                  <li key={i.text} className="flex gap-2">
                    {i.tone === 'warn' ? <TrendingUp size={16} className="mt-0.5 shrink-0 text-expense" aria-hidden /> : i.tone === 'good' ? <TrendingDown size={16} className="mt-0.5 shrink-0 text-income" aria-hidden /> : <Lightbulb size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />}
                    {i.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.budgets.length > 0 && (
            <Card>
              <SectionTitle action={<Link href="/budgets" className="text-sm font-semibold text-brand">Manage</Link>}>Active budgets</SectionTitle>
              <ul className="space-y-3">
                {data.budgets.map((b) => (
                  <li key={b._id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{b.name}</span>
                      <span className="num shrink-0 text-muted">{fmt(b.spent)} / {fmt(b.amount)}</span>
                    </div>
                    <Progress percent={b.percent} status={b.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <SectionTitle action={<Link href="/wallets" className="text-sm font-semibold text-brand">Manage</Link>}>Wallets</SectionTitle>
            <ul className="divide-y divide-line">
              {data.wallets.map((w) => (
                <li key={w._id} className="flex justify-between gap-2 py-2 text-sm">
                  <span className="truncate">{w.name}</span>
                  <span className="num font-bold">{fmt(w.balance)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <TxDetail tx={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function VerifyBanner() {
  const { toast } = useApp();
  const [sent, setSent] = useState(false);
  const resend = async () => {
    try {
      const { api } = await import('@/lib/client');
      await api('/api/account/resend', { method: 'POST' });
      setSent(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Card className="flex items-center justify-between gap-3 !bg-warn-soft !p-3 text-sm">
      <span>Please verify your email address.</span>
      <button type="button" disabled={sent} onClick={resend} className="min-h-8 shrink-0 font-semibold text-warn">{sent ? 'Sent' : 'Resend link'}</button>
    </Card>
  );
}
