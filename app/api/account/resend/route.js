import { route, ApiError } from '@/lib/api';
import { newToken } from '@/lib/tokens';
import { rateLimit } from '@/lib/rateLimit';
import { appUrl, sendActionEmail } from '@/lib/mail';
import { User } from '@/models';

export const POST = route(async ({ user }) => {
  if (user.emailVerified) return { ok: true };
  if (!rateLimit(`resend:${user.id}`, 3, 60 * 60_000).ok) throw new ApiError(429, 'Please wait before asking again.');
  const { token, hash } = newToken();
  await User.updateOne({ _id: user._id }, { verifyTokenHash: hash, verifyExpires: new Date(Date.now() + 24 * 3600_000) });
  await sendActionEmail({
    to: user.email,
    subject: 'Verify your PaisaBachao email',
    heading: 'Verify your email',
    body: 'Confirm your email address to finish setting up your account.',
    cta: 'Verify email',
    url: `${appUrl()}/verify-email?token=${token}`,
  });
  return { ok: true };
});
