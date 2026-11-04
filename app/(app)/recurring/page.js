'use client';

import { Repeat } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import ResourcePage from '@/components/ResourcePage';
import { Badge } from '@/components/ui';

const Item = ({ rule }) => {
  const { fmt, fmtDate } = useApp();
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate font-display text-lg font-bold">{rule.name}</h2>
        <Badge tone={rule.active ? 'good' : 'neutral'}>{rule.active ? rule.frequency : 'Ended'}</Badge>
      </div>
      <p className={`num font-bold ${rule.type === 'income' ? 'text-income' : ''}`}>{rule.type === 'income' ? '+' : '-'}{fmt(rule.amount)}</p>
      {rule.active && <p className="text-xs text-muted">Next entry {fmtDate(rule.nextRun)}</p>}
    </>
  );
};

export default function Recurring() {
  const { data: categories } = useWs('categories');
  const { data: wallets } = useWs('wallets');
  const fields = [
    { name: 'type', label: 'Type', type: 'select', default: 'expense', options: [['expense', 'Expense'], ['income', 'Income']] },
    { name: 'name', label: 'Name', required: true, placeholder: 'e.g. House rent' },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
    { name: 'frequency', label: 'Repeats', type: 'select', default: 'monthly', options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] },
    { name: 'nextRun', label: 'Next entry', type: 'date', required: true },
    { name: 'endDate', label: 'End date (optional)', type: 'date' },
    { name: 'category', label: 'Category', type: 'select', placeholder: 'None', options: (categories || []).map((c) => [c._id, `${c.name} (${c.kind})`]) },
    { name: 'wallet', label: 'Wallet', type: 'select', placeholder: 'None', options: (wallets || []).map((w) => [w._id, w.name]) },
  ];
  return <ResourcePage resource="recurring" title="Recurring" subtitle="Entries added to your Cash Book automatically" noun="Recurring item" icon={Repeat} emptyText="Rent, salary or fees that repeat can be entered for you on schedule." fields={fields} prepare={(f) => ({ ...f, nextRun: new Date(`${f.nextRun}T12:00:00`).toISOString() })} renderItem={(r) => <Item rule={r} />} />;
}
