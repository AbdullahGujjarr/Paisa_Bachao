import bcrypt from 'bcryptjs';
import { route, readJson, ApiError } from '@/lib/api';
import { passwordSchema } from '@/lib/schemas';
import { User } from '@/models';

export const POST = route(async ({ req, user }) => {
  const { current, next } = await readJson(req);
  const dbUser = await User.findById(user._id).select('+passwordHash');
  if (dbUser.passwordHash && !(await bcrypt.compare(String(current || ''), dbUser.passwordHash))) {
    throw new ApiError(400, 'Your current password is not correct.');
  }
  dbUser.passwordHash = await bcrypt.hash(passwordSchema.parse(next), 12);
  dbUser.sessionVersion += 1;
  if (!dbUser.providers.includes('credentials')) dbUser.providers.push('credentials');
  await dbUser.save();
  return { ok: true };
});
