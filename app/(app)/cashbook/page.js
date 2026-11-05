'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Minus, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Button, Card, Empty, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import TxRow from '@/components/TxRow';
import TxDetail from '@/components/TxDetail';
import { formatDate } from '@/lib/format';

const EMPTY = { type: '', category: '', wallet: '', createdBy: '', from: '', to: '', min: '', max: '', tag: '' };

export default function CashBook() {
  const { fmt, openTx, perms, workspace } = useApp();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(40);
  const [detail, setDetail] = useState(null);
  const { data: categories } = useWs('categories');
  const { data: wallets } = useWs('wallets');
  const { data: members } = useWs(workspace?.type === 'shared' ? 'members' : null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(Math.min(limit, 100)) });
    if (q) params.set('q', q);
    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === 'from') params.set(k, new Date(`${v}T00:00:00`).toISOString());
      else if (k === 'to') params.set(k, new Date(`${v}T23:59:59`).toISOString());
      else params.set(k, v);
    });
    return params.toString();
  }, [q, filters, limit]);

  const { data, isLoading } = useWs(`transactions?${query}`);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const active = Object.values(filters).filter(Boolean).length;

  const days = useMemo(() => {
    const groups = new Map();
    for (const t of data?.items || []) {
      const key = formatDate(t.date, 'yyyy-MM-dd');
      if (!groups.has(key)) groups.set(key, { key, items: [], income: 0, expense: 0 });
      const g = groups.get(key);
      g.items.push(t);
      g[t.type] += t.amount;
    }
    return [...groups.values()];
  }, [data]);

  return (
    <div className={perms.add ? 'pb-20 lg:pb-0' : ''}>
      <PageHeader title="Cash Book" subtitle="Every rupee in and out" action={perms.add && <div className="hidden lg:block"><Button onClick={() => openTx({ type: 'expense' })}>Add transaction</Button></div>} />
      {perms.add && (
        <div className="fixed inset-x-0 z-20 px-3 lg:hidden" style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
            <button type="button" onClick={() => openTx({ type: 'income' })} className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#0b6b49] text-base font-bold text-white shadow-lg active:opacity-85">
              <Plus size={22} strokeWidth={3} aria-hidden /> Income
            </button>
            <button type="button" onClick={() => openTx({ type: 'expense' })} className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#b03a1b] text-base font-bold text-white shadow-lg active:opacity-85">
              <Minus size={22} strokeWidth={3} aria-hidden /> Expense
            </button>
          </div>
        </div>
      )}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        {[['Cash in', data?.income, 'text-income', ''], ['Cash out', data?.expense, 'text-expense', ''], ['Balance', (data?.income || 0) - (data?.expense || 0), '', 'col-span-2 md:col-span-1']].map(([label, value, color, span]) => (
          <Card key={label} className={`!p-3 ${span}`}>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className={`num break-words font-display text-lg font-extrabold ${color}`}>{fmt(value || 0)}</p>
          </Card>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-3 text-muted" aria-hidden />
          <Input aria-label="Search transactions" placeholder="Search name, note or tag" value={q} onChange={(e) => setQ(e.target.value)} className="!pl-10" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          <SlidersHorizontal size={16} aria-hidden /> <span className="hidden sm:inline">Filters</span>{active > 0 && ` (${active})`}
        </Button>
      </div>
      {showFilters && (
        <Card className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Type">
            <Select value={filters.type} onChange={set('type')}>
              <option value="">All</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={filters.category} onChange={set('category')}>
              <option value="">All</option>
              {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Wallet">
            <Select value={filters.wallet} onChange={set('wallet')}>
              <option value="">All</option>
              {wallets?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </Select>
          </Field>
          {members && (
            <Field label="Added by">
              <Select value={filters.createdBy} onChange={set('createdBy')}>
                <option value="">Anyone</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="From"><Input type="date" value={filters.from} onChange={set('from')} /></Field>
          <Field label="To"><Input type="date" value={filters.to} onChange={set('to')} /></Field>
          <Field label="Min amount"><Input type="number" inputMode="decimal" value={filters.min} onChange={set('min')} /></Field>
          <Field label="Max amount"><Input type="number" inputMode="decimal" value={filters.max} onChange={set('max')} /></Field>
          <Field label="Tag"><Input value={filters.tag} onChange={set('tag')} /></Field>
          {active > 0 && <Button variant="ghost" className="col-span-2 lg:col-span-1 lg:self-end" onClick={() => setFilters(EMPTY)}>Clear filters</Button>}
        </Card>
      )}
      {isLoading && !data ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : !days.length ? (
        <Card>
          <Empty icon={BookOpen} title={q || active ? 'Nothing matches' : 'Your Cash Book is empty'} text={q || active ? 'Try a different search or filter.' : 'Add your first entry to get started.'} />
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <Card key={d.key} className="!p-3">
              <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs font-semibold text-muted">
                <span>{formatDate(d.key, 'EEE, dd MMM yyyy')}</span>
                <span className="num">
                  {d.income > 0 && <span className="text-income">+{fmt(d.income)}</span>}
                  {d.income > 0 && d.expense > 0 && ' '}
                  {d.expense > 0 && <span>-{fmt(d.expense)}</span>}
                </span>
              </div>
              {d.items.map((t) => <TxRow key={t._id} tx={t} onClick={() => setDetail(t)} />)}
            </Card>
          ))}
          {data?.hasMore && limit < 100 && <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + 30)}>Show more</Button>}
          {data?.hasMore && limit >= 100 && <p className="text-center text-sm text-muted">Showing the latest 100. Use filters or a date range to find older entries.</p>}
        </div>
      )}
      <TxDetail tx={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
