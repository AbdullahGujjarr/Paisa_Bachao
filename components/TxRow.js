'use client';

import CatIcon from './CatIcon';
import { Avatar } from './ui';
import { useApp } from './AppProvider';

export default function TxRow({ tx, onClick }) {
  const { fmt, workspace } = useApp();
  const income = tx.type === 'income';
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2">
      <CatIcon icon={tx.category?.icon} color={tx.category?.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{tx.name}</span>
        <span className="block truncate text-xs text-muted">
          {tx.category?.name || 'Uncategorised'}
          {tx.wallet?.name ? ` · ${tx.wallet.name}` : ''}
        </span>
      </span>
      {workspace?.type === 'shared' && tx.createdBy && <Avatar name={tx.createdBy.name} image={tx.createdBy.image} size={24} />}
      <span className={`num shrink-0 font-bold ${income ? 'text-income' : 'text-ink'}`}>
        {income ? '+' : '-'}
        {fmt(tx.amount)}
      </span>
    </button>
  );
}
