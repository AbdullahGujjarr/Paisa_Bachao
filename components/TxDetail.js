'use client';

import { useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useApp } from './AppProvider';
import { Button, Sheet } from './ui';
import { api } from '@/lib/client';

function Row({ label, children }) {
  if (!children) return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold">{children}</dd>
    </div>
  );
}

export default function TxDetail({ tx, onClose }) {
  const { fmt, fmtDate, ws, perms, openTx, toast, refreshWorkspace, workspace } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!tx) return null;
  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      toast(message);
      refreshWorkspace();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={tx.name}>
      <p className={`num font-display text-3xl font-extrabold ${tx.type === 'income' ? 'text-income' : ''}`}>
        {tx.type === 'income' ? '+' : '-'}
        {fmt(tx.amount)}
      </p>
      <dl className="mt-2 divide-y divide-line">
        <Row label="Date">{fmtDate(tx.date, 'dd MMM yyyy, h:mm a')}</Row>
        <Row label="Category">{tx.category?.name}</Row>
        <Row label="Wallet">{tx.wallet?.name}</Row>
        <Row label="Payment">{tx.paymentMethod}</Row>
        <Row label="Description">{tx.description}</Row>
        <Row label="Notes">{tx.notes}</Row>
        <Row label="Tags">{tx.tags?.join(', ')}</Row>
        {workspace?.type === 'shared' && <Row label="Added by">{tx.createdBy?.name}</Row>}
        {workspace?.type === 'shared' && <Row label="Paid by">{tx.paidBy?.name}</Row>}
        {tx.updatedBy && <Row label="Last edited by">{tx.updatedBy.name}</Row>}
      </dl>
      {tx.attachments?.map((a) => (
        <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm font-semibold text-brand underline">
          {a.name || 'View attachment'}
        </a>
      ))}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {perms.edit && (
          <Button variant="outline" onClick={() => { onClose(); openTx(tx); }}>
            <Pencil size={16} aria-hidden /> Edit
          </Button>
        )}
        {perms.add && (
          <Button variant="outline" loading={busy} onClick={() => run(() => api(ws(`transactions/${tx._id}/duplicate`), { method: 'POST' }), 'Transaction duplicated')}>
            <Copy size={16} aria-hidden /> Copy
          </Button>
        )}
        {perms.delete && (
          <Button variant="danger" loading={busy} onClick={() => (confirm ? run(() => api(ws(`transactions/${tx._id}`), { method: 'DELETE' }), 'Transaction deleted') : setConfirm(true))}>
            <Trash2 size={16} aria-hidden /> {confirm ? 'Sure?' : 'Delete'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
