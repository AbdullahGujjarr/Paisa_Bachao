'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';
import { Pencil, PiggyBank, Trash2 } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Badge, Button, Card, Empty, Field, IconButton, Input, PageHeader, Progress, Select, Sheet, Skeleton } from '@/components/ui';
import { api } from '@/lib/client';
import { toDateInput } from '@/lib/format';

const KINDS = [['household', 'Household'], ['grocery', 'Grocery'], ['personal', 'Personal'], ['travel', 'Travel'], ['education', 'Education'], ['business', 'Business'], ['project', 'Project']];
const STATUS = {
  ok: ['good', 'On track'],
  warning: ['warn', 'Watch it'],
  danger: ['danger', 'Almost gone'],
  over: ['danger', 'Over budget'],
};

function BudgetForm({ budget, onClose }) {
  const { ws, refreshWorkspace, toast } = useApp();
  const { data: categories } = useWs('categories');
  const now = DateTime.now();
  const [form, setForm] = useState({
    name: budget?.name || '',
    kind: budget?.kind || 'household',
    amount: budget?.amount ?? '',
    startDate: toDateInput(budget?.startDate || now.startOf('month').toJSDate()),
    endDate: toDateInput(budget?.endDate || now.endOf('month').toJSDate()),
    categories: budget?.categories?.map(String) || [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) => setForm((f) => ({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...form, startDate: new Date(`${form.startDate}T00:00:00`).toISOString(), endDate: new Date(`${form.endDate}T23:59:59`).toISOString() };
    try {
      if (budget) await api(ws(`budgets/${budget._id}`), { method: 'PATCH', body });
      else await api(ws('budgets'), { method: 'POST', body });
      refreshWorkspace();
      toast('Budget saved');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={budget ? 'Edit budget' : 'New budget'} footer={<Button type="submit" form="budget-form" loading={busy} className="w-full">Save budget</Button>}>
      <form id="budget-form" onSubmit={submit} className="space-y-3">
        <Field label="Name"><Input required value={form.name} onChange={set('name')} placeholder="e.g. November groceries" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Limit"><Input required type="number" inputMode="decimal" min="1" step="0.01" value={form.amount} onChange={set('amount')} /></Field>
          <Field label="Type">
            <Select value={form.kind} onChange={set('kind')}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><Input required type="date" value={form.startDate} onChange={set('startDate')} /></Field>
          <Field label="Ends"><Input required type="date" value={form.endDate} onChange={set('endDate')} /></Field>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Categories</p>
          <p className="mb-2 text-xs text-muted">Leave all off to count every expense in these dates.</p>
          <div className="flex flex-wrap gap-1.5">
            {categories?.filter((c) => c.kind === 'expense').map((c) => (
              <button key={c._id} type="button" aria-pressed={form.categories.includes(c._id)} onClick={() => toggle(c._id)} className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${form.categories.includes(c._id) ? 'border-brand bg-brand text-on-brand' : 'border-line'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}

export default function Budgets() {
  const { fmt, fmtDate, perms, ws, refreshWorkspace, toast } = useApp();
  const { data, isLoading } = useWs('budgets');
  const [form, setForm] = useState(null);
  const remove = async (b) => {
    if (!window.confirm(`Delete the budget "${b.name}"? Its transactions stay in your Cash Book.`)) return;
    try {
      await api(ws(`budgets/${b._id}`), { method: 'DELETE' });
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <div>
      <PageHeader title="Budgets" subtitle="As many as you need, always free" action={perms.add && <Button onClick={() => setForm({})}>New budget</Button>} />
      {isLoading && !data ? <Skeleton className="h-40" /> : !data?.length ? (
        <Card><Empty icon={PiggyBank} title="No budgets yet" text="Set a limit for groceries, a trip or the whole household. You will get alerts at 50%, 75% and 90%." action={perms.add && <Button onClick={() => setForm({})}>Create a budget</Button>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((b) => {
            const [tone, label] = STATUS[b.status];
            return (
              <Card key={b._id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-bold">{b.name}</h2>
                    <p className="text-xs text-muted">{fmtDate(b.startDate, 'dd MMM')} to {fmtDate(b.endDate, 'dd MMM yyyy')}</p>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <p className="num mt-3 font-display text-2xl font-extrabold">{fmt(b.spent)} <span className="text-sm font-semibold text-muted">of {fmt(b.amount)}</span></p>
                <div className="my-2"><Progress percent={b.percent} status={b.status} planned={b.amount ? (b.plannedToDate / b.amount) * 100 : null} /></div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">{b.remaining < 0 ? 'Over by' : 'Left'}</dt><dd className="num font-bold">{fmt(Math.abs(b.remaining))}</dd></div>
                  <div><dt className="text-xs text-muted">Per day</dt><dd className="num font-bold">{fmt(b.dailyAllowance)}</dd></div>
                  <div><dt className="text-xs text-muted">Days left</dt><dd className="num font-bold">{b.daysLeft}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">
                  Planned by now: {fmt(b.plannedToDate)}. You have used {Math.round(b.percent)}%.
                </p>
                <div className="mt-1 flex justify-end">
                  {perms.edit && <IconButton label={`Edit ${b.name}`} onClick={() => setForm({ budget: b })}><Pencil size={18} aria-hidden /></IconButton>}
                  {perms.delete && <IconButton label={`Delete ${b.name}`} onClick={() => remove(b)}><Trash2 size={18} aria-hidden /></IconButton>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {form && <BudgetForm budget={form.budget} onClose={() => setForm(null)} />}
    </div>
  );
}
