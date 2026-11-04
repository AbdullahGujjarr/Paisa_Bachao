'use client';

import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact } from '@/lib/format';
import { useApp } from './AppProvider';
import { Card } from './ui';

const INCOME = 'var(--income)';
const EXPENSE = 'var(--expense)';
const axis = { tick: { fill: 'var(--muted)', fontSize: 11 }, tickLine: false, axisLine: false };
const grid = <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />;

function Tip({ active, payload, label }) {
  const { fmt } = useApp();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      {label && <p className="mb-1 text-xs font-semibold text-muted">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: p.payload?.color || p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto pl-3 font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color }} /> {label}
        </span>
      ))}
    </div>
  );
}

/** Chart panel with a table view, so the numbers are readable without the colours. */
export function ChartCard({ title, legend, columns, rows, children }) {
  const [table, setTable] = useState(false);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{title}</h2>
        {columns && (
          <button type="button" onClick={() => setTable(!table)} className="min-h-8 shrink-0 text-xs font-semibold text-brand">
            {table ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {legend && !table && <div className="mb-2"><Legend items={legend} /></div>}
      {table ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                {columns.map((c, i) => (
                  <th key={c} className={`py-1 font-semibold ${i ? 'text-right' : ''}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="num divide-y divide-line">
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((v, i) => (
                    <td key={i} className={`py-1.5 ${i ? 'text-right' : ''}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

const margin = { top: 6, right: 4, left: 0, bottom: 0 };

export function IncomeExpenseChart({ data, title = 'Income vs expenses' }) {
  const { fmt } = useApp();
  return (
    <ChartCard title={title} legend={[['Income', INCOME], ['Expenses', EXPENSE]]} columns={['Period', 'Income', 'Expenses']} rows={data.map((d) => [d.label, fmt(d.income), fmt(d.expense)])}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={margin} barGap={2}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} width={40} tickFormatter={(v) => compact(v)} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar isAnimationActive={false} dataKey="income" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar isAnimationActive={false} dataKey="expense" name="Expenses" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SpendingTrend({ data, title = 'Spending trend' }) {
  const { fmt } = useApp();
  return (
    <ChartCard title={title} columns={['Period', 'Spent']} rows={data.map((d) => [d.label, fmt(d.expense)])}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} width={40} tickFormatter={(v) => compact(v)} />
          <Tooltip content={<Tip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
          <Line isAnimationActive={false} type="monotone" dataKey="expense" name="Spent" stroke={EXPENSE} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CashFlowChart({ data }) {
  const { fmt } = useApp();
  return (
    <ChartCard title="Cash flow" columns={['Period', 'Net']} rows={data.map((d) => [d.label, fmt(d.net)])}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} width={40} tickFormatter={(v) => compact(v)} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar isAnimationActive={false} dataKey="net" name="Net" radius={[4, 4, 4, 4]} maxBarSize={18}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.net >= 0 ? INCOME : EXPENSE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SavingsChart({ data }) {
  const { fmt } = useApp();
  return (
    <ChartCard title="Savings growth" columns={['Period', 'Saved']} rows={data.map((d) => [d.label, fmt(d.savings)])}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} width={40} tickFormatter={(v) => compact(v)} />
          <Tooltip content={<Tip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
          <Area isAnimationActive={false} type="monotone" dataKey="savings" name="Saved" stroke={INCOME} strokeWidth={2} fill={INCOME} fillOpacity={0.14} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Donut with a labelled list. Past seven slices the rest folds into Other. */
export function CategoryBreakdown({ categories, title = 'Where your money goes' }) {
  const { fmt } = useApp();
  const total = categories.reduce((s, c) => s + c.total, 0);
  const shown = categories.slice(0, 7);
  const rest = categories.slice(7).reduce((s, c) => s + c.total, 0);
  const slices = rest > 0 ? [...shown, { name: 'Other', total: rest, color: '#6b7280' }] : shown;
  return (
    <Card>
      <h2 className="mb-2 font-display text-base font-bold">{title}</h2>
      <div className="grid items-center gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="relative mx-auto h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={slices} dataKey="total" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                {slices.map((c) => (
                  <Cell key={c.name} fill={c.color} />
                ))}
              </Pie>
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[11px] text-muted">Total</p>
              <p className="num text-sm font-bold">{fmt(Math.round(total))}</p>
            </div>
          </div>
        </div>
        <ul className="min-w-0 space-y-1.5">
          {slices.map((c) => (
            <li key={c.name} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="num shrink-0 text-xs text-muted">{total ? Math.round((c.total / total) * 100) : 0}%</span>
              <span className="num shrink-0 font-semibold">{fmt(c.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
