'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { api } from '@/lib/client';

export default function Invite({ params }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/invites/${token}`)
      .then(setInfo)
      .catch((err) => {
        if (err.status === 401) window.location.assign(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
        else setError(err.message);
      });
  }, [token]);

  const respond = async (accept) => {
    setBusy(true);
    setError('');
    try {
      const res = await api(`/api/invites/${token}`, { method: 'POST', body: { accept } });
      if (accept) {
        try {
          localStorage.setItem('pb-workspace', res.workspaceId);
        } catch {}
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center">
        <Users size={36} className="mx-auto text-brand" aria-hidden />
        {info ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-extrabold">Join {info.workspace}</h1>
            <p className="mt-2 text-sm text-muted">
              {info.invitedBy} invited you. Every member can add, edit and delete transactions in this shared budget. Your personal finances stay private.
            </p>
            {info.alreadyMember ? (
              <Button className="mt-5 w-full" onClick={() => router.push('/dashboard')}>You are already a member</Button>
            ) : info.isFull ? (
              <p className="mt-4 text-sm font-semibold text-danger">This shared budget already has 4 members.</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="outline" loading={busy} onClick={() => respond(false)}>Decline</Button>
                <Button loading={busy} onClick={() => respond(true)}>Accept</Button>
              </div>
            )}
          </>
        ) : (
          !error && <p className="mt-3 text-sm text-muted">Loading invitation...</p>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      </div>
    </main>
  );
}
