import { wsRoute, readJson, ApiError } from '@/lib/api';
import { inviteSchema } from '@/lib/schemas';
import { newToken } from '@/lib/tokens';
import { appUrl, mailEnabled, sendActionEmail } from '@/lib/mail';
import { MAX_MEMBERS } from '@/lib/workspace';
import { rateLimit } from '@/lib/rateLimit';
import { Invitation, User } from '@/models';
import { notify } from '@/lib/alerts';

export const GET = wsRoute('manage', async ({ wid }) =>
  Invitation.find({ workspace: wid, status: 'pending', expiresAt: { $gt: new Date() } }).select('email expiresAt createdAt').sort({ createdAt: -1 }).lean(),
);

export const POST = wsRoute('manage', async ({ req, user, wid, workspace }) => {
  if (workspace.type !== 'shared') throw new ApiError(400, 'Personal workspaces stay private. Create a shared workspace to invite people.');
  if (workspace.memberCount >= MAX_MEMBERS) throw new ApiError(409, `A workspace can have up to ${MAX_MEMBERS} members, including the owner.`);
  if (!rateLimit(`invite:${user.id}`, 20, 60 * 60_000).ok) throw new ApiError(429, 'Too many invitations. Try again later.');
  const { email } = inviteSchema.parse(await readJson(req));
  const { token, hash } = newToken();
  await Invitation.create({ workspace: wid, email: email || undefined, tokenHash: hash, invitedBy: user._id, expiresAt: new Date(Date.now() + 7 * 86400_000) });
  const url = `${appUrl()}/invite/${token}`;
  if (email) {
    await sendActionEmail({
      to: email,
      subject: `${user.name} invited you to ${workspace.name} on PaisaBachao`,
      heading: `Join ${workspace.name}`,
      body: `${user.name} wants to manage a shared budget with you. Only this workspace is shared. Your personal finances stay private.`,
      cta: 'View invitation',
      url,
    });
    const existing = await User.findOne({ email }).select('_id').lean();
    if (existing) await notify(existing._id, { kind: 'invite', title: `${user.name} invited you to ${workspace.name}`, link: `/invite/${token}` });
  }
  return { url, emailed: Boolean(email) && mailEnabled };
});
