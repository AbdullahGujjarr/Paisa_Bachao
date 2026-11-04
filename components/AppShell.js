'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Bot, CalendarDays, ChartPie, ChevronDown, CircleDollarSign, FileDown, Goal, HandCoins, House, LayoutGrid, Menu, Moon, PiggyBank, Plus, Repeat, ScanLine, Settings, Sun, Tags, Users, Wallet,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { Avatar, IconButton, Sheet } from './ui';
import Logo from './Logo';
import TxSheet from './TxSheet';
import { api, fetcher } from '@/lib/client';

const NAV = [
  ['Main', [
    ['/dashboard', 'Dashboard', House],
    ['/cashbook', 'Cash Book', BookOpen],
    ['/budgets', 'Budgets', PiggyBank],
    ['/analytics', 'Analytics', ChartPie],
    ['/scan', 'Scan receipt', ScanLine],
    ['/assistant', 'Assistant', Bot],
  ]],
  ['Plan', [
    ['/calendar', 'Calendar', CalendarDays],
    ['/goals', 'Savings goals', Goal],
    ['/debts', 'Udhaar', HandCoins],
    ['/subscriptions', 'Subscriptions', CircleDollarSign],
    ['/recurring', 'Recurring', Repeat],
  ]],
  ['Manage', [
    ['/workspaces', 'Shared budgets', Users],
    ['/wallets', 'Wallets', Wallet],
    ['/categories', 'Categories', Tags],
    ['/reports', 'Reports', FileDown],
    ['/settings', 'Settings', Settings],
  ]],
];

const themeListeners = new Set();
const subscribeTheme = (fn) => {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
};

function useTheme() {
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains('dark'), () => false);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    themeListeners.forEach((fn) => fn());
    try {
      localStorage.setItem('pb-theme', next ? 'dark' : 'light');
    } catch {}
  };
  return { dark, toggle };
}

function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace, live } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  if (!workspace) return <div className="h-11" />;
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 max-w-full items-center gap-2 rounded-xl px-2 hover:bg-surface-2">
        {workspace.type === 'shared' ? <Users size={18} className="shrink-0 text-brand" aria-hidden /> : <Wallet size={18} className="shrink-0 text-brand" aria-hidden />}
        <span className="truncate font-semibold">{workspace.name}</span>
        {workspace.type === 'shared' && <span title={live ? 'Live updates on' : 'Connecting'} className={`size-2 shrink-0 rounded-full ${live ? 'bg-brand' : 'bg-muted'}`} />}
        <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                switchWorkspace(w.id);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-surface-2 ${w.id === workspace.id ? 'font-bold text-brand' : ''}`}
            >
              {w.type === 'shared' ? <Users size={16} aria-hidden /> : <Wallet size={16} aria-hidden />}
              <span className="truncate">{w.name}</span>
              {w.type === 'shared' && <span className="ml-auto text-xs text-muted">{w.memberCount}/4</span>}
            </button>
          ))}
          <Link href="/workspaces" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border-t border-line px-3 text-sm font-semibold text-brand">
            <Plus size={16} aria-hidden /> New shared budget
          </Link>
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { data, mutate } = useSWR('/api/notifications', fetcher);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { fmtDate } = useApp();
  const unread = data?.unread || 0;
  const markAll = async () => {
    await api('/api/notifications', { method: 'PATCH', body: {} });
    mutate();
  };
  return (
    <>
      <IconButton label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setOpen(true)} className="relative">
        <Bell size={20} aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white dark:text-black">{unread > 9 ? '9+' : unread}</span>}
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {unread > 0 && (
          <button type="button" onClick={markAll} className="mb-2 text-sm font-semibold text-brand">
            Mark all as read
          </button>
        )}
        {!data?.items?.length && <p className="py-8 text-center text-sm text-muted">Nothing here yet.</p>}
        <ul className="divide-y divide-line">
          {data?.items?.map((n) => (
            <li key={n._id}>
              <button
                type="button"
                className="block w-full py-3 text-left"
                onClick={async () => {
                  await api('/api/notifications', { method: 'PATCH', body: { id: n._id } });
                  mutate();
                  setOpen(false);
                  if (n.link) router.push(n.link);
                }}
              >
                <span className={`block text-sm ${n.read ? '' : 'font-bold'}`}>{n.title}</span>
                {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                <span className="block text-xs text-muted">{fmtDate(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function NavLinks({ onNavigate }) {
  const path = usePathname();
  return NAV.map(([group, items]) => (
    <div key={group} className="mb-4">
      <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted">{group}</p>
      {items.map(([href, label, Icon]) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? 'bg-brand-soft text-brand dark:text-ink' : 'text-ink hover:bg-surface-2'}`}>
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
    </div>
  ));
}

function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { openTx, perms } = useApp();
  const [more, setMore] = useState(false);
  const [add, setAdd] = useState(false);
  const tab = (href, label, Icon) => {
    const active = path === href;
    return (
      <Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-brand' : 'text-muted'}`}>
        <Icon size={22} aria-hidden /> {label}
      </Link>
    );
  };
  const action = (label, Icon, fn) => (
    <button
      type="button"
      onClick={() => {
        setAdd(false);
        fn();
      }}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 font-semibold hover:bg-surface-2"
    >
      <Icon size={22} className="text-brand" aria-hidden /> {label}
    </button>
  );
  return (
    <>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <div className="mx-auto flex max-w-lg items-center">
          {tab('/dashboard', 'Home', House)}
          {tab('/cashbook', 'Cash Book', BookOpen)}
          <div className="flex flex-1 justify-center">
            <button type="button" aria-label="Add" disabled={!perms.add} onClick={() => setAdd(true)} className="-mt-5 grid size-14 place-items-center rounded-2xl bg-brand text-on-brand shadow-lg disabled:opacity-50">
              <Plus size={26} aria-hidden />
            </button>
          </div>
          {tab('/budgets', 'Budgets', PiggyBank)}
          <button type="button" onClick={() => setMore(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted">
            <LayoutGrid size={22} aria-hidden /> More
          </button>
        </div>
      </nav>
      <Sheet open={add} onClose={() => setAdd(false)} title="Add">
        {action('Add expense', ArrowUpRight, () => openTx({ type: 'expense' }))}
        {action('Add income', ArrowDownLeft, () => openTx({ type: 'income' }))}
        {action('Scan a receipt', ScanLine, () => router.push('/scan'))}
      </Sheet>
      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <NavLinks onNavigate={() => setMore(false)} />
      </Sheet>
    </>
  );
}

export default function AppShell({ children }) {
  const { user, txSheet, perms, openTx } = useApp();
  const { dark, toggle } = useTheme();
  return (
    <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface p-3 lg:flex">
        <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2 pt-1 font-display text-lg font-extrabold">
          <Logo size={34} /> PaisaBachao
        </Link>
        <NavLinks />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-1.5 sm:px-5">
            <Logo size={28} className="mr-1 lg:hidden" />
            <WorkspaceSwitcher />
            <div className="ml-auto flex shrink-0 items-center">
              {perms.add && (
                <button type="button" onClick={() => openTx({ type: 'expense' })} className="mr-2 hidden min-h-10 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-semibold text-on-brand lg:inline-flex">
                  <Plus size={16} aria-hidden /> Add transaction
                </button>
              )}
              <IconButton label={dark ? 'Use light theme' : 'Use dark theme'} onClick={toggle}>
                {dark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
              </IconButton>
              <Notifications />
              <Link href="/settings" aria-label="Settings" className="ml-1 grid size-11 place-items-center">
                <Avatar name={user?.name} image={user?.image} size={32} />
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-5 lg:pb-10">{children}</main>
      </div>
      <BottomNav />
      {txSheet && <TxSheet />}
    </div>
  );
}
