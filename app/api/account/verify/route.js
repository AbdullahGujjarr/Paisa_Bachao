import { publicRoute, readJson, ApiError } from '@/lib/api';
import { hashToken } from '@/lib/tokens';
import { User } from '@/models';

export const POST = publicRoute(async ({ req }) => {
  const { token } = await readJson(req);
  if (typeof token !== 'string') throw new ApiError(400, 'Invalid link.');
  const res = await User.updateOne(
    { verifyTokenHash: hashToken(token), verifyExpires: { $gt: new Date() } },
    { $set: { emailVerified: new Date() }, $unset: { verifyTokenHash: 1, verifyExpires: 1 } },
  );
  if (!res.modifiedCount) throw new ApiError(400, 'This link is invalid or has expired.');
  return { ok: true };
});
