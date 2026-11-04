import bcrypt from 'bcryptjs';
import { route, readJson, ApiError } from '@/lib/api';
import { profileSchema } from '@/lib/schemas';
import { can, createPersonalWorkspace } from '@/lib/workspace';
import { deleteAccount } from '@/lib/account';
import { User, WorkspaceMember } from '@/models';

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  image: u.image,
  emailVerified: Boolean(u.emailVerified),
  hasPassword: u.providers.includes('credentials'),
  providers: u.providers,
  currency: u.currency,
  timezone: u.timezone,
  dateFormat: u.dateFormat,
  personalWorkspace: u.personalWorkspace,
});

export const GET = route(async ({ user }) => {
  if (!user.personalWorkspace) {
    const ws = await createPersonalWorkspace(user);
    user.personalWorkspace = ws._id;
  }
  const memberships = await WorkspaceMember.find({ user: user._id }).populate('workspace').lean();
  const workspaces = memberships
    .filter((m) => m.workspace)
    .map((m) => ({
      id: String(m.workspace._id),
      name: m.workspace.name,
      type: m.workspace.type,
      currency: m.workspace.currency,
      memberCount: m.workspace.memberCount,
      role: m.role,
      perms: { add: can(m, 'add'), edit: can(m, 'edit'), delete: can(m, 'delete'), manage: can(m, 'manage') },
    }));
  return { user: publicUser(user), workspaces };
});

export const PATCH = route(async ({ req, user }) => {
  const data = profileSchema.parse(await readJson(req));
  if (data.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: data.timezone });
    } catch {
      throw new ApiError(422, 'Unknown timezone.');
    }
  }
  const updated = await User.findByIdAndUpdate(user._id, data, { returnDocument: 'after' });
  return { user: publicUser(updated) };
});

export const DELETE = route(async ({ req, user }) => {
  const { password, confirm } = await readJson(req);
  const dbUser = await User.findById(user._id).select('+passwordHash');
  if (dbUser.passwordHash) {
    if (!(await bcrypt.compare(String(password || ''), dbUser.passwordHash))) throw new ApiError(400, 'Your password is not correct.');
  } else if (confirm !== user.email) {
    throw new ApiError(400, 'Type your email address to confirm.');
  }
  await deleteAccount(user);
  return { ok: true };
});
