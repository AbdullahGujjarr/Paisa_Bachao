import { VerifyEmail } from '@/components/AuthForms';

export const metadata = { title: 'Verify email' };

export default async function Page({ searchParams }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token} />;
}
