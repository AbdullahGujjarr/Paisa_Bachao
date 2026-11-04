'use client';

import { Wallet } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import ResourcePage from '@/components/ResourcePage';
import { SWATCHES } from '@/components/ResourceForm';

const FIELDS = [
  { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Easypaisa' },
  { name: 'type', label: 'Type', type: 'select', default: 'cash', options: [['cash', 'Cash'], ['bank', 'Bank'], ['digital', 'Digital wallet'], ['card', 'Card'], ['other', 'Other']] },
  { name: 'openingBalance', label: 'Opening balance', type: 'number', default: 0 },
  { name: 'color', label: 'Colour', type: 'color', options: SWATCHES, default: SWATCHES[0] },
];

const Item = ({ wallet }) => {
  const { fmt } = useApp();
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: wallet.color }} />
        <h2 className="min-w-0 truncate font-display text-lg font-bold">{wallet.name}</h2>
        <span className="ml-auto text-xs capitalize text-muted">{wallet.type}</span>
      </div>
      <p className="num mt-1 font-display text-2xl font-extrabold">{fmt(wallet.balance)}</p>
    </>
  );
};

export default function Wallets() {
  return <ResourcePage resource="wallets" title="Wallets" subtitle="Cash, bank accounts and digital wallets" noun="Wallet" icon={Wallet} emptyText="Add the places you keep your money." fields={FIELDS} renderItem={(w) => <Item wallet={w} />} />;
}
