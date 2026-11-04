import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, ChartColumn, ScanText, Users, Wallet, Bell } from 'lucide-react';
import { auth } from '@/lib/auth';
import Logo from '@/components/Logo';

const FEATURES = [
  [ScanText, 'Receipt to table', 'Photograph a bill and get an editable table of items and prices.'],
  [Users, 'Shared with up to 4', 'Run a household budget together and see each change instantly.'],
  [ChartColumn, 'Real analytics', 'Weekly, monthly and yearly charts, averages and your top categories.'],
  [Wallet, 'Cash Book and wallets', 'Every rupee in and out, across cash, bank and digital wallets.'],
  [Bell, 'Smart alerts', 'Budget warnings, payment reminders and a safe daily spending limit.'],
  [Camera, 'Works like an app', 'Install it on your phone, with your own icon and no Play Store.'],
];

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect('/dashboard');
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <Logo size={36} /> PaisaBachao
        </div>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand">
          Sign in
        </Link>
      </header>
      <section className="note mt-2 rounded-3xl p-7 sm:p-12" style={{ '--note-radius': '1.5rem' }}>
        <p className="text-sm font-semibold uppercase tracking-widest text-white/75">Free. No premium tier.</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">Your Money. Your Control. Your Savings.</h1>
        <p className="mt-4 max-w-xl text-white/85 sm:text-lg">The simplicity of a cash book with the tools other apps charge a subscription for.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/register" className="rounded-xl bg-white px-5 py-3 font-semibold text-[#0b5d3f]">
            Create a free account
          </Link>
          <Link href="/login" className="rounded-xl border border-white/50 px-5 py-3 font-semibold text-white">
            Sign in
          </Link>
        </div>
      </section>
      <section className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, title, text]) => (
          <div key={title}>
            <Icon className="text-brand" size={24} aria-hidden />
            <h2 className="mt-2 font-display text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
