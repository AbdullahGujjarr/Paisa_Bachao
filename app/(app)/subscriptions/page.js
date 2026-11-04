'use client';

import { CircleDollarSign } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import ResourcePage from '@/components/ResourcePage';
import { Badge, Button, Card } from '@/components/ui';
import { api } from '@/lib/client';

const Item = ({ sub }) => {
  const { fmt, fmtDate, ws, perms, toast, refreshWorkspace } = useApp();
  const pay = async () => {
    try {
      await api(ws(`subscriptions/${sub._id}/pay`), { method: 'POST' });
      refreshWorkspace();
      toast(`${sub.name} recorded as paid`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const overdue = new Date(sub.nextPayment) < new Date();
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate font-display text-lg font-bold">{sub.name}</h2>
        {!sub.active ? <Badge>Paused</Badge> : overdue ? <Badge tone="danger">Due</Badge> : null}
      </div>
      <p className="num font-bold">{fmt(sub.amount)} <span className="text-sm font-medium text-muted">/ {sub.cycle.replace('ly', '')}</span></p>
      <p className="text-xs text-muted">Next payment {fmtDate(sub.nextPayment)}</p>
      {perms.add && sub.active && <Button variant="soft" className="mt-2" onClick={pay}>Mark as paid</Button>}
    </>
  );
};

function Totals() {
  const { fmt } = useApp();
  const { data } = useWs('subscriptions');
  const active = data?.filter((s) => s.active) || [];
  if (!active.length) return null;
  const perMonth = active.reduce((sum, s) => sum + s.amount * { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[s.cycle], 0);
  return (
    <Card className="mb-3 !p-3">
      <p className="text-xs font-semibold text-muted">Subscriptions cost you about</p>
      <p className="num font-display text-lg font-extrabold">{fmt(Math.round(perMonth))} a month</p>
    </Card>
  );
}

export default function Subscriptions() {
  const { data: categories } = useWs('categories');
  const fields = [
    { name: 'name', label: 'Service', required: true, placeholder: 'e.g. Internet' },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
    { name: 'cycle', label: 'Billed', type: 'select', default: 'monthly', options: [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] },
    { name: 'nextPayment', label: 'Next payment', type: 'date', required: true },
    { name: 'category', label: 'Category', type: 'select', placeholder: 'None', options: (categories || []).filter((c) => c.kind === 'expense').map((c) => [c._id, c.name]) },
    { name: 'remindDays', label: 'Remind me (days before)', type: 'number', default: 3 },
  ];
  return (
    <>
      <Totals />
      <ResourcePage resource="subscriptions" title="Subscriptions" subtitle="Everything that bills you regularly" noun="Subscription" icon={CircleDollarSign} emptyText="Add services you pay for and get reminded before each payment." fields={fields} prepare={(f) => ({ ...f, nextPayment: new Date(`${f.nextPayment}T12:00:00`).toISOString() })} renderItem={(s) => <Item sub={s} />} />
    </>
  );
}
