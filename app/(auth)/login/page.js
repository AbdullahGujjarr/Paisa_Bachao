import { LoginForm } from '@/components/AuthForms';
import { googleEnabled } from '@/lib/auth';

export const metadata = { title: 'Sign in' };

export default async function Page({ searchParams }) {
  const { callbackUrl } = await searchParams;
  return <LoginForm google={googleEnabled} callbackUrl={callbackUrl} />;
}
