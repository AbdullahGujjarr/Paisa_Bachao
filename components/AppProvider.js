'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { io } from 'socket.io-client';
import { api, fetcher } from '@/lib/client';
import { formatDate, money } from '@/lib/format';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

/** Fetches a path inside the active workspace, for example useWs('summary'). */
export function useWs(path, options) {
  const { wid } = useApp();
  return useSWR(wid && path ? `/api/w/${wid}/${path}` : null, fetcher, options);
}

function Toasts({ items }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className={`sheet-in max-w-md rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${t.tone === 'error' ? 'bg-danger text-white dark:text-black' : 'bg-ink text-bg'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Provider({ children }) {
  const { mutate } = useSWRConfig();
  const { data: account, mutate: refreshAccount } = useSWR('/api/account', fetcher);
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem('pb-workspace');
    } catch {
      return null; // No storage during server rendering or in locked-down browsers.
    }
  });
  const [toasts, setToasts] = useState([]);
  const [live, setLive] = useState(false);
  const [txSheet, setTxSheet] = useState(null);
  const userId = useRef(null);
  useEffect(() => {
    userId.current = account?.user?.id;
  }, [account]);

  const toast = useCallback((text, tone = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const workspaces = useMemo(() => account?.workspaces || [], [account]);
  const workspace = useMemo(
    () => workspaces.find((w) => w.id === selected) || workspaces.find((w) => w.type === 'personal') || workspaces[0] || null,
    [workspaces, selected],
  );
  const wid = workspace?.id || null;

  const switchWorkspace = useCallback((id) => {
    setSelected(id);
    try {
      localStorage.setItem('pb-workspace', id);
    } catch {}
  }, []);

  const refreshWorkspace = useCallback(() => mutate((key) => typeof key === 'string' && key.startsWith(`/api/w/${wid}`)), [mutate, wid]);

  // Live sync: one socket per session. Any change in the workspace refetches what is on screen.
  useEffect(() => {
    if (!wid) return undefined;
    const socket = io({
      auth: (cb) => {
        api('/api/realtime/token')
          .then(({ ticket }) => cb({ ticket }))
          .catch(() => cb({}));
      },
    });
    const join = () => socket.emit('join', wid, (res) => setLive(Boolean(res?.ok)));
    socket.on('connect', join);
    socket.on('disconnect', () => setLive(false));
    socket.on('changed', (e) => {
      if (e.workspaceId !== wid) return;
      refreshWorkspace();
      if (e.by && e.by !== userId.current && e.summary) toast(e.summary);
      if (e.entity === 'member') refreshAccount();
    });
    socket.on('notification', (n) => {
      mutate('/api/notifications');
      toast(n.title);
    });
    socket.on('membership', () => refreshAccount());
    return () => socket.disconnect();
  }, [wid, mutate, refreshAccount, refreshWorkspace, toast]);

  const value = useMemo(() => {
    const currency = workspace?.currency || 'PKR';
    const user = account?.user || null;
    return {
      user,
      workspaces,
      workspace,
      wid,
      live,
      perms: workspace?.perms || {},
      currency,
      fmt: (n) => money(n, currency),
      fmtDate: (d, f) => formatDate(d, f || user?.dateFormat || 'dd MMM yyyy'),
      switchWorkspace,
      refreshAccount,
      refreshWorkspace,
      toast,
      txSheet,
      openTx: (tx = {}) => setTxSheet(tx),
      closeTx: () => setTxSheet(null),
      ws: (path) => `/api/w/${wid}/${path}`,
    };
  }, [account, workspaces, workspace, wid, live, switchWorkspace, refreshAccount, refreshWorkspace, toast, txSheet]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <Toasts items={toasts} />
    </AppContext.Provider>
  );
}

export default function AppProvider({ children }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 1500, keepPreviousData: true }}>
      <Provider>{children}</Provider>
    </SWRConfig>
  );
}
