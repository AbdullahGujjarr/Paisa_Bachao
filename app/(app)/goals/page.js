'use client';

import { useState } from 'react';
import { Goal } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import ResourcePage from '@/components/ResourcePage';
import { SWATCHES } from '@/components/ResourceForm';
import { Button, Input, Progress } from '@/components/ui';
import { api } from '@/lib/client';
import { daysUntil } from '@/lib/format';

const FIELDS = [
  { name: 'name', label: 'Goal', required: true, placeholder: 'e.g. New motorbike' },
  { name: 'targetAmount', label: 'Target amount', type: 'number', required: true },
  { name: 'savedAmount', label: 'Saved so far', type: 'number', default: 0 },
  { name: 'deadline', label: 'Target date', type: 'date' },
  { name: 'color', label: 'Colour', type: 'color', options: SWATCHES, default: SWATCHES[0] },
];

function Item({ goal }) {
  const { fmt, fmtDate, ws, refreshWorkspace, toast, perms } = useApp();
  const [add, setAdd] = useState('');
  const pct = goal.targetAmount ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const left = Math.max(0, goal.targetAmount - goal.savedAmount);
  const contribute = async (e) => {
    e.preventDefault();
    try {
      await api(ws(`goals/${goal._id}`), { method: 'PATCH', body: { savedAmount: goal.savedAmount + Number(add) } });
      setAdd('');
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <>
      <h2 className="font-display text-lg font-bold">{goal.name}</h2>
      <p className="num mt-1 font-bold">{fmt(goal.savedAmount)} <span className="text-sm font-medium text-muted">of {fmt(goal.targetAmount)}</span></p>
      <div className="my-2"><Progress percent={pct} /></div>
      <p className="text-xs text-muted">
        {left === 0 ? 'Goal reached.' : `${fmt(left)} to go`}
        {goal.deadline && left > 0 && (days > 0 ? `. Save ${fmt(Math.ceil(left / (days / 30.44)))} a month to reach it by ${fmtDate(goal.deadline, 'dd MMM yyyy')}.` : '. The target date has passed.')}
      </p>
      {perms.edit && left > 0 && (
        <form onSubmit={contribute} className="mt-2 flex gap-2">
          <Input aria-label={`Add money to ${goal.name}`} type="number" inputMode="decimal" min="1" step="0.01" required value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Amount" />
          <Button type="submit" variant="soft">Add</Button>
        </form>
      )}
    </>
  );
}

export default function Goals() {
  return <ResourcePage resource="goals" title="Savings goals" subtitle="Set a target and watch it fill" noun="Goal" icon={Goal} emptyText="Saving for a bike, a wedding or an emergency fund? Set a target here." fields={FIELDS} renderItem={(g) => <Item goal={g} />} />;
}
