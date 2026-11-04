'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button, Field, Input } from './ui';
import { api } from '@/lib/client';

const safeCallback = (url) => (url && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard');

function GoogleButton({ callbackUrl }) {
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => signIn('google', { callbackUrl })}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
        </svg>
        Continue with Google
      </Button>
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function LoginForm({ google, callbackUrl }) {
  const target = safeCallback(callbackUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    const res = await signIn('credentials', { email: data.get('email'), password: data.get('password'), redirect: false });
    if (res?.error) {
      setError('That email and password do not match.');
      setBusy(false);
    } else {
      window.location.href = target;
    }
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Welcome back</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Sign in to your PaisaBachao account.</p>
      {google && <GoogleButton callbackUrl={target} />}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand">Forgot password?</Link>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here? <Link href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(target)}` : ''}`} className="font-semibold text-brand">Create an account</Link>
      </p>
    </>
  );
}

export function RegisterForm({ google, callbackUrl }) {
  const target = safeCallback(callbackUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/api/account/register', { method: 'POST', body: data });
      await signIn('credentials', { email: data.email, password: data.password, redirect: false });
      window.location.href = target;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Create your account</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Everything is free. No card needed.</p>
      {google && <GoogleButton callbackUrl={target} />}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Your name"><Input name="name" autoComplete="name" required maxLength={80} /></Field>
        <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" hint="At least 8 characters"><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/account/forgot', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Reset your password</h1>
      {sent ? (
        <p className="mt-3 text-sm text-muted">If that email has an account, a reset link is on its way. It works for one hour.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field label="Email"><Input name="email" type="email" required /></Field>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-brand">Back to sign in</Link></p>
    </>
  );
}

export function ResetForm({ token }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/account/reset', { method: 'POST', body: { token, password: new FormData(e.currentTarget).get('password') } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Choose a new password</h1>
      {done ? (
        <p className="mt-3 text-sm text-muted">Your password is updated. <Link href="/login" className="font-semibold text-brand">Sign in</Link></p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field label="New password" hint="At least 8 characters"><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Update password</Button>
        </form>
      )}
    </>
  );
}

export function VerifyEmail({ token }) {
  const [state, setState] = useState('ready');
  const [error, setError] = useState('');
  // Verification waits for a click because mail scanners open links automatically.
  const verify = async () => {
    setState('busy');
    try {
      await api('/api/account/verify', { method: 'POST', body: { token } });
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('ready');
    }
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Verify your email</h1>
      {state === 'done' ? (
        <p className="mt-3 text-sm text-muted">Your email is verified. <Link href="/dashboard" className="font-semibold text-brand">Go to your dashboard</Link></p>
      ) : (
        <Button loading={state === 'busy'} onClick={verify} className="mt-5 w-full">Confirm my email</Button>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
    </>
  );
}
