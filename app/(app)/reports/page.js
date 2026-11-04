'use client';

import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { saveFile } from '@/lib/client';
import { toDateInput } from '@/lib/format';

const KINDS = [
  ['daily', 'Today'],
  ['weekly', 'This week'],
  ['monthly', 'This month'],
  ['yearly', 'This year'],
  ['custom', 'Custom dates'],
  ['budget', 'One budget'],
  ['category', 'One category'],
  ['cashbook', 'Complete Cash Book'],
];

export default function Reports() {
  const { ws, toast } = useApp();
  const { data: budgets } = useWs('budgets');
  const { data: categories } = useWs('categories');
  const [kind, setKind] = useState('monthly');
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => toDateInput());
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState('');

  const download = async (format) => {
    const p = new URLSearchParams({ kind, format });
    if (kind === 'custom' || kind === 'category') {
      p.set('from', from);
      p.set('to', to);
    }
    if (kind === 'budget') {
      if (!budget) return toast('Choose a budget first.', 'error');
      p.set('budget', budget);
    }
    if (kind === 'category') {
      if (!category) return toast('Choose a category first.', 'error');
      p.set('category', category);
    }
    setBusy(format);
    try {
      const name = await saveFile(ws(`reports?${p}`));
      toast(`Saved ${name}`);
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy('');
    return undefined;
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="Reports" subtitle="Save your finances to your phone or computer" />
      <Card className="space-y-3">
        <Field label="What to include">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        {kind === 'budget' && (
          <Field label="Budget">
            <Select value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="">Choose</option>
              {budgets?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        {kind === 'category' && (
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose</option>
              {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {(kind === 'custom' || kind === 'category') && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button loading={busy === 'pdf'} onClick={() => download('pdf')}><FileText size={16} aria-hidden /> PDF</Button>
          <Button variant="soft" loading={busy === 'xlsx'} onClick={() => download('xlsx')}><FileSpreadsheet size={16} aria-hidden /> Excel</Button>
          <Button variant="soft" loading={busy === 'csv'} onClick={() => download('csv')}><FileDown size={16} aria-hidden /> CSV</Button>
        </div>
      </Card>
    </div>
  );
}
