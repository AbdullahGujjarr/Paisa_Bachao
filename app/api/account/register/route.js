import bcrypt from 'bcryptjs';
import { publicRoute, readJson, ApiError } from '@/lib/api';
import { registerSchema } from '@/lib/schemas';
import { User } from '@/models';
import { createPersonalWorkspace } from '@/lib/workspace';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { newToken } from '@/lib/tokens';
import { appUrl, sendActionEmail } from '@/lib/mail';

export const POST = publicRoute(async ({ req }) => {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000).ok) throw new ApiError(429, 'Too many attempts. Try again later.');
  const data = registerSchema.parse(await readJson(req));
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'An account with this email already exists.');
  const { token, hash } = newToken();
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    providers: ['credentials'],
    verifyTokenHash: hash,
    verifyExpires: new Date(Date.now() + 24 * 3600_000),
  });
  await createPersonalWorkspace(user);
  await sendActionEmail({
    to: user.email,
    subject: 'Verify your PaisaBachao email',
    heading: `Welcome, ${user.name}`,
    body: 'Confirm your email address to finish setting up your account.',
    cta: 'Verify email',
    url: `${appUrl()}/verify-email?token=${token}`,
  });
  return { ok: true };
});
