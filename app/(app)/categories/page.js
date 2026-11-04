'use client';

import { Tags } from 'lucide-react';
import ResourcePage from '@/components/ResourcePage';
import { SWATCHES } from '@/components/ResourceForm';
import CatIcon, { ICON_NAMES } from '@/components/CatIcon';

const FIELDS = [
  { name: 'name', label: 'Name', required: true },
  { name: 'kind', label: 'Used for', type: 'select', default: 'expense', options: [['expense', 'Expenses'], ['income', 'Income']] },
  { name: 'icon', label: 'Icon', type: 'select', default: 'Tag', options: ICON_NAMES.map((n) => [n, n]) },
  { name: 'color', label: 'Colour', type: 'color', options: SWATCHES, default: SWATCHES[0] },
];

export default function Categories() {
  return (
    <ResourcePage
      resource="categories"
      title="Categories"
      subtitle="Make them match how you spend"
      noun="Category"
      icon={Tags}
      emptyText="Add a category."
      fields={FIELDS}
      renderItem={(c) => (
        <div className="flex items-center gap-3">
          <CatIcon icon={c.icon} color={c.color} />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{c.name}</h2>
            <p className="text-xs capitalize text-muted">{c.kind}</p>
          </div>
        </div>
      )}
    />
  );
}
