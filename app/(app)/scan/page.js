'use client';

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, FileUp, Loader2, Plus, ScanLine, Sparkles, Trash2 } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Segmented, Select } from '@/components/ui';
import { METHODS } from '@/components/TxSheet';
import { api } from '@/lib/client';
import { toDateInput } from '@/lib/format';

const round2 = (n) => Math.round(n * 100) / 100;

function Review({ job, onDone, onRemove }) {
  const { ws, fmt, toast, refreshWorkspace } = useApp();
  const { scan } = job;
  const { data: categories } = useWs('categories');
  const { data: wallets } = useWs('wallets');
  const { data: budgets } = useWs('budgets');
  const [items, setItems] = useState(() => (scan.items.length ? scan.items : [{ name: '', quantity: '1', price: '' }]).map((i, k) => ({ ...i, key: k })));
  const [store, setStore] = useState(scan.store || '');
  const [date, setDate] = useState(toDateInput(scan.date || new Date()));
  const [tax, setTax] = useState(scan.tax ?? '');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('');
  const [budget, setBudget] = useState('');
  const [method, setMethod] = useState('cash');
  const [mode, setMode] = useState('single');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key, field, value) => setItems((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const total = round2(items.reduce((s, i) => s + (Number(i.price) || 0), 0) + (Number(tax) || 0));
  const mismatch = scan.total != null && Math.abs(scan.total - total) > 0.5;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api(ws('scan/save'), {
        method: 'POST',
        body: {
          scanId: scan._id, mode, store, category, wallet, budget, paymentMethod: method,
          date: new Date(`${date}T12:00:00`).toISOString(),
          items: items.map(({ name, quantity, price }) => ({ name, quantity: String(quantity || ''), price })),
          tax: tax || 0,
        },
      });
      refreshWorkspace();
      toast('Receipt saved to your Cash Book');
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate font-display font-bold">{job.name}</h2>
        <Badge tone={scan.method === 'ai' ? 'good' : 'neutral'}>
          {scan.method === 'ai' ? <><Sparkles size={12} aria-hidden /> AI read</> : scan.method === 'pdf-text' ? 'PDF text' : 'OCR read'}
        </Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
        {job.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.preview} alt="Your document" className="max-h-64 w-full rounded-xl border border-line object-contain lg:max-h-96" />
        ) : <div className="hidden lg:block" />}
        <div className="min-w-0">
          {!scan.items.length && <p className="mb-2 rounded-xl bg-warn-soft p-2.5 text-sm text-warn">No items could be read. Type them in below, or try a clearer photo.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Store"><Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store name" /></Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_2.5rem] gap-1.5 text-xs font-semibold text-muted">
            <span>Item</span><span>Qty</span><span>Price</span><span />
          </div>
          <div className="mt-1 space-y-1.5">
            {items.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_2.5rem] items-center gap-1.5">
                <Input aria-label="Item name" value={r.name} onChange={(e) => update(r.key, 'name', e.target.value)} className="!px-2" />
                <Input aria-label="Quantity" value={r.quantity ?? ''} onChange={(e) => update(r.key, 'quantity', e.target.value)} className="!px-2" />
                <Input aria-label="Price" type="number" inputMode="decimal" step="0.01" value={r.price ?? ''} onChange={(e) => update(r.key, 'price', e.target.value)} className="num !px-2" />
                <IconButton label="Delete row" className="!size-10" onClick={() => setItems((rows) => rows.filter((x) => x.key !== r.key))}><Trash2 size={16} aria-hidden /></IconButton>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-1" onClick={() => setItems((rows) => [...rows, { key: Date.now(), name: '', quantity: '1', price: '' }])}><Plus size={16} aria-hidden /> Add row</Button>
          <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-3">
            <Field label="Tax" className="w-28"><Input type="number" inputMode="decimal" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="num" /></Field>
            <div className="min-w-0 text-right">
              <p className="text-xs font-semibold text-muted">Total</p>
              <p className="num truncate font-display text-2xl font-extrabold">{fmt(total)}</p>
            </div>
          </div>
          {mismatch && <p className="mt-2 rounded-xl bg-warn-soft p-2.5 text-sm text-warn">The document says {fmt(scan.total)}. Please check the rows before saving.</p>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">None</option>
                {categories?.filter((c) => c.kind === 'expense').map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Budget">
              <Select value={budget} onChange={(e) => setBudget(e.target.value)}>
                <option value="">Automatic</option>
                {budgets?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Wallet">
              <Select value={wallet} onChange={(e) => setWallet(e.target.value)}>
                <option value="">None</option>
                {wallets?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </Select>
            </Field>
            <Field label="Paid with">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-sm font-semibold">Save as</p>
            <Segmented label="Save as" value={mode} onChange={setMode} options={[['single', 'One transaction'], ['items', 'One per item']]} />
          </div>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button variant="outline" onClick={onRemove}>Discard</Button>
            <Button loading={busy} onClick={save}>Confirm and save</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Scan() {
  const { ws, perms } = useApp();
  const [jobs, setJobs] = useState([]);
  const camera = useRef(null);
  const files = useRef(null);
  const patch = (id, data) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...data } : j)));

  const start = async (list) => {
    const incoming = [...list].map((file) => ({
      id: Math.random(),
      file,
      name: file.name || 'Photo',
      status: 'reading',
      preview: file.type.startsWith('image/') && !/hei[cf]/i.test(file.type) ? URL.createObjectURL(file) : null,
    }));
    setJobs((all) => [...incoming, ...all]);
    // One at a time, so a phone on a slow connection is not uploading several files at once.
    for (const job of incoming) {
      try {
        const form = new FormData();
        form.append('file', job.file);
        const scan = await api(ws('scan'), { method: 'POST', form });
        patch(job.id, { status: 'review', scan });
      } catch (err) {
        patch(job.id, { status: 'error', error: err.message });
      }
    }
  };

  const onPick = (e) => {
    if (e.target.files?.length) start(e.target.files);
    e.target.value = '';
  };

  return (
    <div>
      <PageHeader title="Scan a receipt" subtitle="Photos, PDFs, bills and handwritten lists become an editable table" />
      {perms.add ? (
        <Card
          className="mb-3 border-dashed"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) start(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-col items-center py-6 text-center">
            <ScanLine size={36} className="text-brand" aria-hidden />
            <p className="mt-2 font-display text-lg font-bold">Add a document</p>
            <p className="mb-4 text-sm text-muted">Nothing is saved until you review it and confirm.</p>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              <Button onClick={() => camera.current.click()}><Camera size={18} aria-hidden /> Take photo</Button>
              <Button variant="outline" onClick={() => files.current.click()}><FileUp size={18} aria-hidden /> Upload files</Button>
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} aria-label="Take a photo" />
            <input ref={files} type="file" multiple accept="image/*,.heic,.heif,application/pdf" className="sr-only" onChange={onPick} aria-label="Upload files" />
          </div>
        </Card>
      ) : (
        <Card className="mb-3 text-sm text-muted">You have view-only access to this workspace, so you cannot add receipts.</Card>
      )}
      <div className="space-y-3">
        {jobs.map((job) => {
          if (job.status === 'reading') {
            return <Card key={job.id} className="flex items-center gap-3 text-sm"><Loader2 size={18} className="animate-spin text-brand" aria-hidden /> Reading {job.name}. This can take a few seconds.</Card>;
          }
          if (job.status === 'error') {
            return <Card key={job.id} className="text-sm"><p className="font-semibold text-danger">{job.name}: {job.error}</p></Card>;
          }
          if (job.status === 'saved') {
            return <Card key={job.id} className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={18} className="text-income" aria-hidden /> {job.name} saved</Card>;
          }
          return <Review key={job.id} job={job} onDone={() => patch(job.id, { status: 'saved' })} onRemove={() => setJobs((all) => all.filter((j) => j.id !== job.id))} />;
        })}
      </div>
    </div>
  );
}
