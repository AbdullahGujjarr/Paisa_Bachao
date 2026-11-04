'use client';

import { useState } from 'react';
import { ChartPie, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Card, Empty, Field, Input, PageHeader, SectionTitle, Segmented, Skeleton } from '@/components/ui';
import { CashFlowChart, CategoryBreakdown, IncomeExpenseChart, SavingsChart, SpendingTrend } from '@/components/charts';
import { toDateInput } from '@/lib/format';

function Tile({ label, value, sub }) {
  return (
    <div className="min-w-0 py-1">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="num break-words font-display text-lg font-extrabold leading-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { fmt, fmtDate } = useApp();
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => toDateInput());
  const query = preset === 'custom' ? `preset=custom&from=${from}&to=${to}` : `preset=${preset}`;
  const { data, isLoading } = useWs(`analytics?${query}`);
  const s = data?.stats;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="All figures come from your own transactions" />
      <div className="mb-3">
        <Segmented label="Period" value={preset} onChange={setPreset} options={[['day', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom']]} />
      </div>
      {preset === 'custom' && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      )}
      {isLoading && !data ? <Skeleton className="h-64" /> : !data?.totals.count ? (
        <Card><Empty icon={ChartPie} title="No transactions in this period" text="Your charts appear here as soon as you record income or expenses." /></Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
              <Tile label="Income" value={fmt(data.totals.income)} sub={s.incomeChange !== null ? `${s.incomeChange > 0 ? '+' : ''}${Math.round(s.incomeChange)}% on last period` : undefined} />
              <Tile label="Expenses" value={fmt(data.totals.expense)} sub={s.expenseChange !== null ? `${s.expenseChange > 0 ? '+' : ''}${Math.round(s.expenseChange)}% on last period` : undefined} />
              <Tile label="Saved" value={fmt(s.savings)} sub={s.savingsRate !== null ? `${Math.round(s.savingsRate)}% of income` : undefined} />
              <Tile label="Income to expense" value={s.incomeToExpense !== null ? `${s.incomeToExpense}x` : 'No expenses'} />
            </div>
          </Card>
          {data.insights.length > 0 && (
            <Card>
              <SectionTitle>What stands out</SectionTitle>
              <ul className="grid gap-2 text-sm md:grid-cols-2">
                {data.insights.map((i) => (
                  <li key={i.text} className="flex gap-2">
                    {i.tone === 'warn' ? <TrendingUp size={16} className="mt-0.5 shrink-0 text-expense" aria-hidden /> : i.tone === 'good' ? <TrendingDown size={16} className="mt-0.5 shrink-0 text-income" aria-hidden /> : <Lightbulb size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />}
                    {i.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <IncomeExpenseChart data={data.series} />
            {data.categories.length > 0 ? <CategoryBreakdown categories={data.categories} /> : <Card><Empty title="No expenses in this period" /></Card>}
            <SpendingTrend data={data.series} />
            <CashFlowChart data={data.series} />
            <SavingsChart data={data.series} />
            <IncomeExpenseChart data={data.months} title="Last 12 months compared" />
          </div>
          <Card>
            <SectionTitle>Your averages and records</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
              <Tile label="Average per day" value={fmt(s.avgDaily)} />
              <Tile label="Average per week" value={fmt(s.avgWeekly)} />
              <Tile label="Average per month" value={fmt(s.avgMonthly)} />
              <Tile label="Highest spending day" value={s.highestDay ? fmt(s.highestDay.total) : 'None'} sub={s.highestDay && fmtDate(s.highestDay.date, 'dd MMM yyyy')} />
              <Tile label="Lowest spending day" value={s.lowestDay ? fmt(s.lowestDay.total) : 'None'} sub={s.lowestDay && fmtDate(s.lowestDay.date, 'dd MMM yyyy')} />
              <Tile label="Most expensive category" value={s.topCategory?.name || 'None'} sub={s.topCategory && fmt(s.topCategory.total)} />
              <Tile label="Most used category" value={s.mostFrequent?.name || 'None'} sub={s.mostFrequent && `${s.mostFrequent.count} transactions`} />
              <Tile label="Biggest transaction" value={s.largest ? fmt(s.largest.amount) : 'None'} sub={s.largest?.name} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
