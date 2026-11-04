import { publicRoute, readJson, ApiError } from '@/lib/api';
import { emailSchema } from '@/lib/schemas';
import { newToken } from '@/lib/tokens';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { appUrl, sendActionEmail } from '@/lib/mail';
import { User } from '@/models';

export const POST = publicRoute(async ({ req }) => {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60_000).ok) throw new ApiError(429, 'Too many attempts. Try again later.');
  const email = emailSchema.parse((await readJson(req)).email);
  const user = await User.findOne({ email });
  if (user) {
    const { token, hash } = newToken();
    await User.updateOne({ _id: user._id }, { resetTokenHash: hash, resetExpires: new Date(Date.now() + 3600_000) });
    await sendActionEmail({
      to: user.email,
      subject: 'Reset your PaisaBachao password',
      heading: 'Reset your password',
      body: 'This link works for one hour. If you did not ask for it, you can ignore this email.',
      cta: 'Choose a new password',
      url: `${appUrl()}/reset-password?token=${token}`,
    });
  }
  // The same reply either way, so this form cannot be used to discover who has an account.
  return { ok: true };
});
