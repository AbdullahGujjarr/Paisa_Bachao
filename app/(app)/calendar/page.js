'use client';

import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp, useWs } from '@/components/AppProvider';
import { Card, Empty, IconButton, PageHeader, SectionTitle } from '@/components/ui';
import { compact } from '@/lib/format';
import TxRow from '@/components/TxRow';
import TxDetail from '@/components/TxDetail';

export default function Calendar() {
  const { fmt } = useApp();
  const [month, setMonth] = useState(() => DateTime.now().startOf('month'));
  const [day, setDay] = useState(() => DateTime.now().toISODate());
  const [detail, setDetail] = useState(null);
  const { data } = useWs(`calendar?month=${month.toFormat('yyyy-MM')}`);
  const selected = DateTime.fromISO(day);
  const { data: list } = useWs(`transactions?limit=100&from=${encodeURIComponent(selected.startOf('day').toUTC().toISO())}&to=${encodeURIComponent(selected.endOf('day').toUTC().toISO())}`);

  const cells = useMemo(() => {
    const blanks = month.weekday - 1;
    return [...Array(blanks).fill(null), ...Array.from({ length: month.daysInMonth }, (_, i) => month.plus({ days: i }))];
  }, [month]);

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Your money by date" />
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Previous month" onClick={() => setMonth(month.minus({ months: 1 }))}><ChevronLeft size={20} aria-hidden /></IconButton>
          <h2 className="font-display font-bold">{month.toFormat('MMMM yyyy')}</h2>
          <IconButton label="Next month" onClick={() => setMonth(month.plus({ months: 1 }))}><ChevronRight size={20} aria-hidden /></IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={`b${i}`} />;
            const iso = c.toISODate();
            const info = data?.days?.[iso];
            const isSelected = iso === day;
            return (
              <button key={iso} type="button" onClick={() => setDay(iso)} aria-pressed={isSelected} className={`flex min-h-14 min-w-0 flex-col items-center rounded-lg p-1 text-sm ${isSelected ? 'bg-brand text-on-brand' : 'hover:bg-surface-2'}`}>
                <span className="font-semibold">{c.day}</span>
                {info?.expense > 0 && <span className={`num max-w-full truncate text-[10px] ${isSelected ? '' : 'text-expense'}`}>-{compact(info.expense, 0)}</span>}
                {info?.income > 0 && <span className={`num max-w-full truncate text-[10px] ${isSelected ? '' : 'text-income'}`}>+{compact(info.income, 0)}</span>}
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="mt-3">
        <SectionTitle action={list?.expense > 0 && <span className="num text-sm text-muted">{fmt(list.expense)} spent</span>}>{selected.toFormat('dd MMMM')}</SectionTitle>
        {list?.items?.length ? list.items.map((t) => <TxRow key={t._id} tx={t} onClick={() => setDetail(t)} />) : <Empty title="Nothing on this day" />}
      </Card>
      <TxDetail tx={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
