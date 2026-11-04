'use client';

import { useState } from 'react';
import { Button, Field, Input, Select, Sheet, Textarea } from './ui';
import { toDateInput } from '@/lib/format';

/** Generic create/edit sheet driven by a field list. */
export default function ResourceForm({ title, fields, initial, onSubmit, onClose }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      fields.map((f) => {
        const v = initial?.[f.name] ?? f.default ?? '';
        const value = v && typeof v === 'object' && v._id ? v._id : v;
        return [f.name, f.type === 'date' && value ? toDateInput(value) : value];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (name, value) => setForm((s) => ({ ...s, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={title} footer={<Button type="submit" form="resource-form" loading={busy} className="w-full">Save</Button>}>
      <form id="resource-form" onSubmit={submit} className="space-y-3">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            {f.type === 'select' ? (
              <Select value={form[f.name]} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                {f.placeholder && <option value="">{f.placeholder}</option>}
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            ) : f.type === 'textarea' ? (
              <Textarea value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === 'color' ? (
              <div className="flex flex-wrap gap-2">
                {f.options.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={form[f.name] === c} onClick={() => set(f.name, c)} className={`size-9 rounded-full ${form[f.name] === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c }} />
                ))}
              </div>
            ) : (
              <Input
                type={f.type || 'text'}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                step={f.type === 'number' ? '0.01' : undefined}
                required={f.required}
                value={form[f.name]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </Field>
        ))}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}

export const SWATCHES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#0e9aa7', '#6b7280'];
