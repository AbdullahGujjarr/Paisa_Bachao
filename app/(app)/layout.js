import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AppProvider from '@/components/AppProvider';
import AppShell from '@/components/AppShell';

export default async function Layout({ children }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
