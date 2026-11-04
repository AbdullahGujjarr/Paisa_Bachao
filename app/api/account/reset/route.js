import bcrypt from 'bcryptjs';
import { publicRoute, readJson, ApiError } from '@/lib/api';
import { passwordSchema } from '@/lib/schemas';
import { hashToken } from '@/lib/tokens';
import { User } from '@/models';

export const POST = publicRoute(async ({ req }) => {
  const { token, password } = await readJson(req);
  const hash = await bcrypt.hash(passwordSchema.parse(password), 12);
  const res = await User.updateOne(
    { resetTokenHash: hashToken(token), resetExpires: { $gt: new Date() } },
    {
      $set: { passwordHash: hash, emailVerified: new Date() },
      $unset: { resetTokenHash: 1, resetExpires: 1 },
      $inc: { sessionVersion: 1 },
      $addToSet: { providers: 'credentials' },
    },
  );
  if (!res.modifiedCount) throw new ApiError(400, 'This link is invalid or has expired.');
  return { ok: true };
});
