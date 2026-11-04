'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { Button, Card, IconButton, Input, PageHeader } from '@/components/ui';
import { api } from '@/lib/client';

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Where does most of my money go?',
  'How much did I spend on food last week?',
  'Compare this month with last month',
  'How much can I safely spend today?',
  'Which category should I reduce?',
  'Show my biggest expenses',
];

function Proposal({ proposal, onDone }) {
  const { fmt, ws, toast, refreshWorkspace, perms } = useApp();
  const [state, setState] = useState('ask');
  const confirm = async () => {
    setState('busy');
    try {
      await api(ws('transactions'), { method: 'POST', body: { type: proposal.type, name: proposal.name, amount: proposal.amount, category: proposal.category, date: new Date().toISOString() } });
      refreshWorkspace();
      setState('done');
      onDone('Added to your Cash Book.');
    } catch (err) {
      toast(err.message, 'error');
      setState('ask');
    }
  };
  if (state === 'done') return null;
  if (state === 'no') return <p className="mt-2 text-sm text-muted">Cancelled. Nothing was saved.</p>;
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-3">
      <p className="font-semibold">{proposal.name}</p>
      <p className="num text-sm text-muted">{proposal.type === 'income' ? 'Income' : 'Expense'} · {fmt(proposal.amount)}{proposal.categoryName ? ` · ${proposal.categoryName}` : ''}</p>
      {perms.add ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setState('no')}>Cancel</Button>
          <Button loading={state === 'busy'} onClick={confirm}>Confirm</Button>
        </div>
      ) : <p className="mt-1 text-sm text-muted">You have view-only access here.</p>}
    </div>
  );
}

export default function Assistant() {
  const { ws, wid } = useApp();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    setMessages([]);
  }, [wid]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    const history = messages.filter((m) => m.content).slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    try {
      const res = await api(ws('assistant'), { method: 'POST', body: { text: q, history } });
      setMessages((m) => [...m, { role: 'assistant', content: res.text, proposal: res.proposal }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err.message }]);
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col lg:min-h-[calc(100dvh-7rem)]">
      <PageHeader title="Assistant" subtitle="Answers come from your real numbers. It never changes anything without asking." />
      <div className="min-w-0 flex-1 space-y-3">
        {!messages.length && (
          <Card>
            <Bot size={28} className="text-brand" aria-hidden />
            <p className="mt-2 font-display font-bold">Ask about your money</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="min-h-9 rounded-full border border-line px-3 py-1 text-left text-sm font-medium hover:bg-surface-2">{s}</button>
              ))}
            </div>
          </Card>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-brand text-on-brand' : 'border border-line bg-surface'}`}>
              {m.content}
              {m.proposal && <Proposal proposal={m.proposal} onDone={(t) => setMessages((all) => [...all, { role: 'assistant', content: t }])} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Checking your numbers...</p>}
        <div ref={end} />
      </div>
      <form
        className="sticky bottom-20 mt-3 flex gap-2 lg:bottom-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <Input aria-label="Your question" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Ask, or say: spent 500 on lunch" />
        <IconButton label="Send" type="submit" className="bg-brand !text-on-brand hover:!bg-brand"><Send size={18} aria-hidden /></IconButton>
      </form>
    </div>
  );
}
