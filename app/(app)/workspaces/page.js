'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { Check, Copy, Link2, Lock, Plus, Trash2, UserMinus, Users } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Input, PageHeader, SectionTitle, Select, Sheet } from '@/components/ui';
import { api } from '@/lib/client';
import { CURRENCIES } from '@/lib/format';

function CreateSheet({ onClose }) {
  const { user, switchWorkspace, refreshAccount } = useApp();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(user?.currency || 'PKR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api('/api/workspaces', { method: 'POST', body: { name, currency } });
      await refreshAccount();
      switchWorkspace(id);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="New shared budget" footer={<Button type="submit" form="ws-form" loading={busy} className="w-full">Create</Button>}>
      <form id="ws-form" onSubmit={submit} className="space-y-3">
        <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family home" /></Field>
        <Field label="Currency"><Select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <p className="text-sm text-muted">This is separate from your personal workspace. Members only ever see what is recorded here.</p>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}

function Invite() {
  const { ws, toast, workspace, refreshWorkspace } = useApp();
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: invites } = useWs('invites');
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api(ws('invites'), { method: 'POST', body: { email } });
      setLink(res.url);
      toast(res.emailed ? `Invitation sent to ${email}` : 'Invitation link created');
      setEmail('');
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(false);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const revoke = async (id) => {
    await api(ws(`invites/${id}`), { method: 'DELETE' });
    refreshWorkspace();
  };
  if (workspace.memberCount >= 4) return <p className="mt-3 text-sm text-muted">This shared budget is full, with 4 of 4 members.</p>;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="mb-2 font-semibold">Invite someone</h3>
      <form onSubmit={send} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input type="email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email, or leave empty for a link" />
        <Button type="submit" loading={busy}>{email ? 'Send invite' : <><Link2 size={16} aria-hidden /> Get link</>}</Button>
      </form>
      {link && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-2 p-2">
          <span className="min-w-0 flex-1 truncate text-sm">{link}</span>
          <IconButton label="Copy link" onClick={copy}>{copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}</IconButton>
        </div>
      )}
      {invites?.length > 0 && (
        <ul className="mt-2 divide-y divide-line text-sm">
          {invites.map((i) => (
            <li key={i._id} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0 truncate">{i.email || 'Open link'}</span>
              <button type="button" className="min-h-9 font-semibold text-danger" onClick={() => revoke(i._id)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Member({ m }) {
  const { ws, perms, user, toast, refreshWorkspace, refreshAccount, fmtDate } = useApp();
  const remove = async () => {
    const self = m.id === user.id;
    if (!window.confirm(self ? 'Leave this shared budget?' : `Remove ${m.name}?`)) return;
    try {
      await api(ws(`members/${m.id}`), { method: 'DELETE' });
      await refreshAccount();
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const canManage = perms.manage && m.role !== 'owner';
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Avatar name={m.name} image={m.image} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name}{m.id === user.id ? ' (you)' : ''}</p>
          <p className="truncate text-xs text-muted">{m.lastActivity ? `${m.lastActivity.summary}, ${fmtDate(m.lastActivity.at, 'dd MMM')}` : m.email}</p>
        </div>
        <Badge tone={m.role === 'owner' ? 'good' : 'neutral'}>{m.role === 'owner' ? 'Owner' : 'Member'}</Badge>
        {m.role !== 'owner' && (canManage || m.id === user.id) && <IconButton label={m.id === user.id ? 'Leave' : `Remove ${m.name}`} onClick={remove}><UserMinus size={18} aria-hidden /></IconButton>}
      </div>
    </li>
  );
}

function Settlement() {
  const { fmt, ws, perms, toast, refreshWorkspace } = useApp();
  const [month, setMonth] = useState(() => DateTime.now().toFormat('yyyy-MM'));
  const { data } = useWs(`settlement?month=${month}`);
  const name = (id) => data?.profiles?.[id]?.name || 'Former member';
  const settle = async (t) => {
    try {
      await api(ws('settlement'), { method: 'POST', body: { from: t.from, to: t.to, amount: t.amount, date: DateTime.fromFormat(month, 'yyyy-MM').endOf('month').minus({ hours: 1 }).toISO() } });
      refreshWorkspace();
      toast('Settlement recorded');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Card>
      <SectionTitle action={<Input type="month" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="!min-h-9 !w-40 !py-1" />}>Who owes whom</SectionTitle>
      {data && (
        <>
          <p className="text-sm text-muted">Total spent {fmt(data.total)}, split equally at {fmt(data.share)} each.</p>
          <ul className="mt-2 divide-y divide-line text-sm">
            {data.balances.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">{name(b.id)} paid <span className="num font-semibold">{fmt(b.paid)}</span></span>
                <span className={`num shrink-0 font-bold ${b.balance >= 0 ? 'text-income' : 'text-expense'}`}>{b.balance >= 0 ? '+' : ''}{fmt(b.balance)}</span>
              </li>
            ))}
          </ul>
          {data.transfers.length > 0 ? (
            <div className="mt-2 space-y-2">
              {data.transfers.map((t) => (
                <div key={`${t.from}${t.to}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2.5 text-sm">
                  <span className="min-w-0"><b>{name(t.from)}</b> pays <b>{name(t.to)}</b> <span className="num font-bold">{fmt(t.amount)}</span></span>
                  {perms.add && <Button variant="soft" className="!min-h-9 shrink-0" onClick={() => settle(t)}>Settled</Button>}
                </div>
              ))}
            </div>
          ) : data.total > 0 && <p className="mt-2 text-sm font-semibold text-income">Everyone is settled up.</p>}
        </>
      )}
    </Card>
  );
}

function Activity() {
  const { fmtDate } = useApp();
  const { data } = useWs('activity');
  return (
    <Card>
      <SectionTitle>Activity</SectionTitle>
      {!data?.items?.length ? <p className="text-sm text-muted">No activity yet.</p> : (
        <ul className="max-h-96 space-y-2.5 overflow-y-auto">
          {data.items.map((a) => (
            <li key={a._id} className="flex items-start gap-2.5 text-sm">
              <Avatar name={a.user?.name || a.userName} image={a.user?.image} size={28} />
              <div className="min-w-0">
                <p className="break-words">{a.summary}</p>
                <p className="text-xs text-muted">{fmtDate(a.createdAt, 'dd MMM, h:mm a')}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Workspaces() {
  const { workspace, workspaces, switchWorkspace, perms, ws, refreshAccount, toast, wid } = useApp();
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const shared = workspace?.type === 'shared';
  const { data: members } = useWs(shared ? 'members' : null);

  const destroy = async () => {
    if (window.prompt(`This permanently deletes everything in "${workspace.name}" for all members. Type the name to confirm.`) !== workspace.name) return;
    try {
      await api(ws(''), { method: 'DELETE' });
      switchWorkspace(null);
      await refreshAccount();
      router.push('/dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Shared budgets" subtitle="Up to 4 people, and everyone can add, edit and delete transactions" action={<Button onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> New</Button>} />
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {workspaces.map((w) => (
          <button key={w.id} type="button" onClick={() => switchWorkspace(w.id)} aria-pressed={w.id === wid} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${w.id === wid ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}>
            {w.type === 'shared' ? <Users size={14} aria-hidden /> : <Lock size={14} aria-hidden />} {w.name}
          </button>
        ))}
      </div>
      {!shared ? (
        <Card>
          <Empty icon={Lock} title="Your personal workspace is private" text="Nobody else can ever see it. Create a shared budget to manage money with a partner, family or friends." action={<Button onClick={() => setCreating(true)}>Create a shared budget</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <SectionTitle action={<span className="num text-sm text-muted">{members?.length || 0} of 4</span>}>Members</SectionTitle>
            <ul className="divide-y divide-line">{members?.map((m) => <Member key={m.id} m={m} />)}</ul>
            {perms.manage && <Invite />}
          </Card>
          <div className="min-w-0 space-y-3">
            <Settlement />
            <Activity />
          </div>
          {perms.manage && (
            <Card className="lg:col-span-2">
              <Button variant="danger" onClick={destroy}><Trash2 size={16} aria-hidden /> Delete this shared budget</Button>
            </Card>
          )}
        </div>
      )}
      {creating && <CreateSheet onClose={() => setCreating(false)} />}
    </div>
  );
}
