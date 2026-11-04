'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useApp, useWs } from './AppProvider';
import { Button, Card, Empty, IconButton, PageHeader, Skeleton } from './ui';
import ResourceForm from './ResourceForm';
import { api } from '@/lib/client';

/** Shared list screen for goals, debts, subscriptions, recurring items, wallets and categories. */
export default function ResourcePage({ resource, title, subtitle, noun, icon, emptyText, fields, renderItem, prepare = (f) => f, canDelete = () => true, grid = true }) {
  const { ws, perms, toast, refreshWorkspace } = useApp();
  const { data, isLoading } = useWs(resource);
  const [editing, setEditing] = useState(null);

  const save = async (form) => {
    const body = prepare(form);
    if (editing._id) await api(ws(`${resource}/${editing._id}`), { method: 'PATCH', body });
    else await api(ws(resource), { method: 'POST', body });
    refreshWorkspace();
    toast(`${noun} saved`);
    setEditing(null);
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name || item.person}?`)) return;
    try {
      await api(ws(`${resource}/${item._id}`), { method: 'DELETE' });
      refreshWorkspace();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} action={perms.add && <Button onClick={() => setEditing({})}>Add {noun.toLowerCase()}</Button>} />
      {isLoading && !data ? <Skeleton className="h-32" /> : !data?.length ? (
        <Card><Empty icon={icon} title={`No ${title.toLowerCase()} yet`} text={emptyText} action={perms.add && <Button onClick={() => setEditing({})}>Add {noun.toLowerCase()}</Button>} /></Card>
      ) : (
        <div className={grid ? 'grid gap-3 md:grid-cols-2' : 'space-y-2'}>
          {data.map((item) => (
            <Card key={item._id} className="!p-4">
              {renderItem(item)}
              <div className="-mb-2 mt-1 flex justify-end">
                {perms.edit && <IconButton label={`Edit ${item.name || item.person}`} onClick={() => setEditing(item)}><Pencil size={18} aria-hidden /></IconButton>}
                {perms.delete && canDelete(item) && <IconButton label={`Delete ${item.name || item.person}`} onClick={() => remove(item)}><Trash2 size={18} aria-hidden /></IconButton>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <ResourceForm title={editing._id ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`} fields={typeof fields === 'function' ? fields(editing) : fields} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
