import Link from 'next/link';
import Logo from '@/components/Logo';

export default function AuthLayout({ children }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <aside className="note hidden flex-col justify-between p-12 lg:flex" style={{ '--note-radius': '0px' }}>
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Logo size={40} /> PaisaBachao
        </Link>
        <div>
          <p className="font-display text-5xl font-extrabold leading-tight">Your Money. Your Control. Your Savings.</p>
          <p className="mt-4 max-w-md text-white/85">Scan receipts, share a budget with up to four people, and see where every rupee goes. All of it free.</p>
        </div>
        <p className="text-sm text-white/70">No premium tier. No locked features.</p>
      </aside>
      <div className="flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-6 flex items-center gap-2 font-display text-xl font-bold lg:hidden">
            <Logo size={38} /> PaisaBachao
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
