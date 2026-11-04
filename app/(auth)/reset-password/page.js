import { ResetForm } from '@/components/AuthForms';

export const metadata = { title: 'Reset password' };

export default async function Page({ searchParams }) {
  const { token } = await searchParams;
  return <ResetForm token={token} />;
}
