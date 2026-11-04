'use client';

import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import ResourcePage from '@/components/ResourcePage';
import { Badge, Button, Card, Input, Progress } from '@/components/ui';
import { api } from '@/lib/client';

const FIELDS = [
  { name: 'direction', label: 'Type', type: 'select', default: 'lent', options: [['lent', 'I lent money'], ['borrowed', 'I borrowed money']] },
  { name: 'person', label: 'Person', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'dueDate', label: 'Repayment date', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function Item({ debt }) {
  const { fmt, fmtDate, ws, refreshWorkspace, toast, perms } = useApp();
  const [pay, setPay] = useState('');
  const left = Math.round((debt.amount - debt.paid) * 100) / 100;
  const overdue = debt.dueDate && left > 0 && new Date(debt.dueDate) < new Date();
  const repay = async (e) => {
    e.preventDefault();
    try {
      await api(ws(`debts/${debt._id}/payments`), { method: 'POST', body: { amount: pay } });
      setPay('');
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate font-display text-lg font-bold">{debt.person}</h2>
        <Badge tone={left === 0 ? 'good' : overdue ? 'danger' : debt.direction === 'lent' ? 'neutral' : 'warn'}>{left === 0 ? 'Settled' : overdue ? 'Overdue' : debt.direction === 'lent' ? 'Owes you' : 'You owe'}</Badge>
      </div>
      <p className="num mt-1 font-bold">{fmt(left)} <span className="text-sm font-medium text-muted">left of {fmt(debt.amount)}</span></p>
      <div className="my-2"><Progress percent={debt.amount ? (debt.paid / debt.amount) * 100 : 0} /></div>
      {debt.dueDate && <p className="text-xs text-muted">Due {fmtDate(debt.dueDate)}</p>}
      {debt.notes && <p className="mt-1 text-sm text-muted">{debt.notes}</p>}
      {perms.edit && left > 0 && (
        <form onSubmit={repay} className="mt-2 flex gap-2">
          <Input aria-label={`Repayment for ${debt.person}`} type="number" inputMode="decimal" min="0.01" max={left} step="0.01" required value={pay} onChange={(e) => setPay(e.target.value)} placeholder="Repayment" />
          <Button type="submit" variant="soft">Record</Button>
        </form>
      )}
    </>
  );
}

function Totals() {
  const { fmt } = useApp();
  const { data } = useWs('debts');
  if (!data?.length) return null;
  const sum = (dir) => data.filter((d) => d.direction === dir).reduce((s, d) => s + d.amount - d.paid, 0);
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <Card className="!p-3"><p className="text-xs font-semibold text-muted">People owe you</p><p className="num font-display text-lg font-extrabold text-income">{fmt(sum('lent'))}</p></Card>
      <Card className="!p-3"><p className="text-xs font-semibold text-muted">You owe</p><p className="num font-display text-lg font-extrabold text-expense">{fmt(sum('borrowed'))}</p></Card>
    </div>
  );
}

export default function Debts() {
  return (
    <>
      <Totals />
      <ResourcePage resource="debts" title="Udhaar" subtitle="Money you have lent and borrowed" noun="Entry" icon={HandCoins} emptyText="Keep track of who owes what, with repayments and due dates." fields={FIELDS} renderItem={(d) => <Item debt={d} />} />
    </>
  );
}
