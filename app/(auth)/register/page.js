import { RegisterForm } from '@/components/AuthForms';
import { googleEnabled } from '@/lib/auth';

export const metadata = { title: 'Create account' };

export default async function Page({ searchParams }) {
  const { callbackUrl } = await searchParams;
  return <RegisterForm google={googleEnabled} callbackUrl={callbackUrl} />;
}
