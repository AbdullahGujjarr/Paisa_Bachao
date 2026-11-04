'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { signOut } from 'next-auth/react';
import { Download, LogOut } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { Avatar, Button, Card, Field, Input, PageHeader, SectionTitle, Select } from '@/components/ui';
import { api } from '@/lib/client';
import { CURRENCIES } from '@/lib/format';

const ZONES = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'UTC'];

function Profile() {
  const { user, refreshAccount, toast } = useApp();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const update = async (body, message) => {
    try {
      await api('/api/account', { method: 'PATCH', body });
      await refreshAccount();
      if (message) toast(message);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const uploadPicture = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await api('/api/upload', { method: 'POST', form });
      await update({ image: url }, 'Picture updated');
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(false);
  };
  return (
    <Card>
      <SectionTitle>Profile</SectionTitle>
      <div className="flex items-center gap-4">
        <Avatar name={user.name} image={user.image} size={64} />
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-3 text-sm font-semibold">
          {busy ? 'Uploading...' : 'Change picture'}
          <input type="file" accept="image/*" className="sr-only" onChange={uploadPicture} />
        </label>
      </div>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ name }, 'Name updated');
        }}
      >
        <Field label="Name" className="min-w-0 flex-1"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Button type="submit" variant="soft">Save</Button>
      </form>
      <p className="mt-2 truncate text-sm text-muted">{user.email}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Currency" hint="For new workspaces">
          <Select value={user.currency} onChange={(e) => update({ currency: e.target.value }, 'Currency updated')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Date format">
          <Select value={user.dateFormat} onChange={(e) => update({ dateFormat: e.target.value }, 'Date format updated')}>
            {['dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Timezone" className="col-span-2">
          <Select value={user.timezone} onChange={(e) => update({ timezone: e.target.value }, 'Timezone updated')}>
            {[...new Set([user.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}
          </Select>
        </Field>
      </div>
    </Card>
  );
}

function WorkspaceCurrency() {
  const { workspace, perms, ws, refreshAccount, toast } = useApp();
  if (!perms.manage) return null;
  const change = async (e) => {
    try {
      await api(ws(''), { method: 'PATCH', body: { currency: e.target.value } });
      await refreshAccount();
      toast('Workspace currency updated');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Card>
      <SectionTitle>{workspace.name} workspace</SectionTitle>
      <Field label="Currency" hint="Changes the symbol shown. Existing amounts are not converted.">
        <Select value={workspace.currency} onChange={change}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
      </Field>
    </Card>
  );
}

function Password() {
  const { user, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await api('/api/account/password', { method: 'POST', body: { current: data.get('current'), next: data.get('next') } });
      toast('Password changed. Please sign in again.');
      setTimeout(() => signOut({ callbackUrl: '/login' }), 1000);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Card>
      <SectionTitle>{user.hasPassword ? 'Change password' : 'Set a password'}</SectionTitle>
      <form onSubmit={submit} className="space-y-3">
        {user.hasPassword && <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>}
        <Field label="New password" hint="At least 8 characters"><Input name="next" type="password" autoComplete="new-password" required minLength={8} /></Field>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button type="submit" variant="soft" loading={busy}>Update password</Button>
      </form>
    </Card>
  );
}

function Install() {
  const [prompt, setPrompt] = useState(null);
  const standalone = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia('(display-mode: standalone)').matches,
    () => false,
  );
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (standalone) return null;
  return (
    <Card>
      <SectionTitle>Install the app</SectionTitle>
      {prompt ? (
        <Button variant="soft" onClick={() => prompt.prompt()}><Download size={16} aria-hidden /> Install PaisaBachao</Button>
      ) : (
        <p className="text-sm text-muted">On Android, open your browser menu and choose Install app. On iPhone, tap Share and then Add to Home Screen.</p>
      )}
    </Card>
  );
}

function Danger() {
  const { user, toast } = useApp();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const logoutAll = async () => {
    await api('/api/account/logout-all', { method: 'POST' });
    signOut({ callbackUrl: '/login' });
  };
  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/account', { method: 'DELETE', body: user.hasPassword ? { password: value } : { confirm: value } });
      signOut({ callbackUrl: '/' });
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };
  return (
    <Card>
      <SectionTitle>Sessions and account</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}><LogOut size={16} aria-hidden /> Sign out</Button>
        <Button variant="outline" onClick={logoutAll}>Sign out everywhere</Button>
        <Button variant="danger" onClick={() => setOpen(!open)}>Delete account</Button>
      </div>
      {open && (
        <form onSubmit={remove} className="mt-3 space-y-2">
          <p className="text-sm text-muted">This permanently deletes your account and personal data. Shared budgets pass to another member.</p>
          <Field label={user.hasPassword ? 'Enter your password to confirm' : 'Type your email to confirm'}>
            <Input type={user.hasPassword ? 'password' : 'email'} required value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" loading={busy}>Permanently delete my account</Button>
        </form>
      )}
    </Card>
  );
}

export default function Settings() {
  const { user } = useApp();
  if (!user) return null;
  return (
    <div className="max-w-2xl space-y-3">
      <PageHeader title="Settings" />
      <Profile />
      <WorkspaceCurrency />
      <Password />
      <Install />
      <Danger />
    </div>
  );
}
