import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { dbConnect } from './db';
import { User } from '@/models';
import { createPersonalWorkspace } from './workspace';
import { rateLimit } from './rateLimit';

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email || '').toLowerCase().trim();
        const password = String(creds?.password || '');
        if (!email || !password) return null;
        if (!rateLimit(`login:${email}`, 8, 15 * 60_000).ok) return null;
        await dbConnect();
        const user = await User.findOne({ email }).select('+passwordHash');
        if (!user?.passwordHash) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!profile?.email_verified) return false;
      await dbConnect();
      const email = profile.email.toLowerCase();
      let user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        user = await User.create({
          name: profile.name || email.split('@')[0],
          email,
          image: profile.picture,
          emailVerified: new Date(),
          providers: ['google'],
        });
        await createPersonalWorkspace(user);
        return true;
      }
      // An unverified password on this email may belong to someone who never owned the
      // address, so Google's proof of ownership replaces it rather than merging with it.
      if (!user.emailVerified) {
        user.passwordHash = undefined;
        user.emailVerified = new Date();
        user.sessionVersion += 1;
      }
      if (!user.providers.includes('google')) user.providers.push('google');
      if (!user.image && profile.picture) user.image = profile.picture;
      await user.save();
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        await dbConnect();
        const dbUser = await User.findOne({ email: user.email.toLowerCase() });
        if (dbUser) {
          token.uid = dbUser.id;
          token.sv = dbUser.sessionVersion;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.sv = token.sv;
      return session;
    },
  },
});
