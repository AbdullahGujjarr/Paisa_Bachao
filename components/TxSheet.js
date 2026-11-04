'use client';

import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useApp, useWs } from './AppProvider';
import { Button, Field, Input, Segmented, Select, Sheet, Textarea } from './ui';
import { api } from '@/lib/client';
import { toLocalInput } from '@/lib/format';

export const METHODS = [['cash', 'Cash'], ['bank', 'Bank transfer'], ['card', 'Card'], ['easypaisa', 'Easypaisa'], ['jazzcash', 'JazzCash'], ['other', 'Other']];

const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || '';

export default function TxSheet() {
  const { txSheet: tx, closeTx, ws, toast, refreshWorkspace, workspace, user } = useApp();
  const { data: categories } = useWs('categories');
  const { data: wallets } = useWs('wallets');
  const { data: budgets } = useWs('budgets');
  const { data: members } = useWs(workspace?.type === 'shared' ? 'members' : null);
  const editing = Boolean(tx._id);
  const [form, setForm] = useState({
    type: tx.type || 'expense',
    amount: tx.amount ?? '',
    name: tx.name || '',
    category: idOf(tx.category),
    wallet: idOf(tx.wallet),
    budget: idOf(tx.budget),
    date: toLocalInput(tx.date || new Date()),
    paymentMethod: tx.paymentMethod || 'cash',
    paidBy: idOf(tx.paidBy) || user?.id || '',
    description: tx.description || '',
    notes: tx.notes || '',
    tags: (tx.tags || []).join(', '),
    attachments: tx.attachments || [],
  });
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form2 = new FormData();
      form2.append('file', file);
      const res = await api('/api/upload', { method: 'POST', form: form2 });
      setForm((f) => ({ ...f, attachments: [...f.attachments, res] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
      date: new Date(form.date).toISOString(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      paidBy: workspace?.type === 'shared' ? form.paidBy : undefined,
    };
    try {
      if (editing) await api(ws(`transactions/${tx._id}`), { method: 'PATCH', body });
      else await api(ws('transactions'), { method: 'POST', body });
      if (repeat) {
        const step = { daily: 1, weekly: 7 }[repeat];
        const next = new Date(form.date);
        if (step) next.setDate(next.getDate() + step);
        else if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);
        else next.setFullYear(next.getFullYear() + 1);
        await api(ws('recurring'), {
          method: 'POST',
          body: { type: form.type, name: form.name, amount: form.amount, category: form.category, wallet: form.wallet, paymentMethod: form.paymentMethod, frequency: repeat, nextRun: next.toISOString() },
        });
      }
      refreshWorkspace();
      toast(editing ? 'Transaction updated' : 'Transaction added');
      closeTx();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const visible = categories?.filter((c) => c.kind === form.type) || [];
  return (
    <Sheet
      open
      onClose={closeTx}
      title={editing ? 'Edit transaction' : form.type === 'income' ? 'Add income' : 'Add expense'}
      footer={
        <Button type="submit" form="tx-form" loading={busy} className="w-full">
          {editing ? 'Save changes' : 'Save'}
        </Button>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-3">
        <Segmented value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v, category: '' }))} options={[['expense', 'Expense'], ['income', 'Income']]} label="Type" />
        <Field label="Amount">
          <Input required inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0" className="num text-2xl font-bold" autoFocus={!editing} />
        </Field>
        <Field label="Name">
          <Input required maxLength={120} value={form.name} onChange={set('name')} placeholder={form.type === 'income' ? 'e.g. Salary' : 'e.g. Groceries'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              <option value="">None</option>
              {visible.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Wallet">
            <Select value={form.wallet} onChange={set('wallet')}>
              <option value="">None</option>
              {wallets?.map((w) => (
                <option key={w._id} value={w._id}>{w.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Date and time">
          <Input required type="datetime-local" value={form.date} onChange={set('date')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method">
            <Select value={form.paymentMethod} onChange={set('paymentMethod')}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          {form.type === 'expense' && (
            <Field label="Budget">
              <Select value={form.budget} onChange={set('budget')}>
                <option value="">Automatic</option>
                {budgets?.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {members && (
          <Field label="Paid by">
            <Select value={form.paidBy} onChange={set('paidBy')}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Description">
          <Input maxLength={500} value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Notes">
          <Textarea maxLength={1000} value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Tags" hint="Separate with commas">
          <Input value={form.tags} onChange={set('tags')} placeholder="family, urgent" />
        </Field>
        {!editing && (
          <Field label="Repeat">
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </Select>
          </Field>
        )}
        <div>
          <span className="mb-1 block text-sm font-semibold">Receipt or attachment</span>
          {form.attachments.map((a, i) => (
            <div key={a.url} className="mb-1 flex items-center gap-2 text-sm">
              <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-brand underline">{a.name || 'Attachment'}</a>
              <button type="button" aria-label="Remove attachment" className="grid size-8 place-items-center" onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, j) => j !== i) }))}>
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold">
            <Paperclip size={16} aria-hidden /> {uploading ? 'Uploading...' : 'Attach a file'}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={upload} />
          </label>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}
