import Logo from '@/components/Logo';

export const metadata = { title: 'Offline' };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <Logo size={64} className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-muted">PaisaBachao needs a connection to keep your numbers up to date. It will work again once you are back online.</p>
      </div>
    </main>
  );
}
