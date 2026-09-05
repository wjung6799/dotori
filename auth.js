import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import clientPromise from '@/lib/mongodb';
import authConfig from '@/auth.config';

// Full Auth.js config (Node.js runtime, used by the /api/auth/[...nextauth]
// route handler). Extends the edge-safe base with the MongoDB adapter and the
// email/password Credentials provider. JWT session strategy is required so the
// Credentials provider works alongside the adapter.
// How often a live session re-checks the database for a password change. The
// trade-off: an attacker holding a stolen session survives a victim's password
// reset for at most this long, and each session costs one indexed Mongo read
// per interval — not per request.
const PASSWORD_RECHECK_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    // Wraps the edge-safe jwt callback with the one thing it cannot do there:
    // a database look. Each JWT carries pwt — the passwordChangedAt it was
    // issued under — and dies (return null → signed out) the first re-check
    // after a reset moves that timestamp. This is what makes "reset your
    // password" actually evict whoever was holding the old one.
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (!token?.id) return token;

      const readPwt = async () => {
        const db = (await clientPromise).db();
        const u = await db
          .collection('users')
          .findOne({ _id: new ObjectId(token.id) }, { projection: { passwordChangedAt: 1 } });
        return u?.passwordChangedAt?.getTime() || 0;
      };

      if (params.user) {
        // Fresh sign-in: stamp the current password version.
        try {
          token.pwt = await readPwt();
        } catch {
          token.pwt = 0;
        }
        token.pwck = Date.now();
        return token;
      }

      if (Date.now() - (token.pwck || 0) < PASSWORD_RECHECK_MS) return token;
      try {
        if ((token.pwt || 0) !== (await readPwt())) return null;
        token.pwck = Date.now();
      } catch {
        // A database hiccup must not sign the whole school out.
      }
      return token;
    },
  },
  events: {
    // OAuth (Google) users are created by the adapter with no `role`, so they
    // never appear in the admin/tutor family lists (which query role:'family').
    // Default new adapter-created users to 'family'. Credentials signups set
    // their own role in /api/register, so this only affects OAuth users.
    async createUser({ user }) {
      try {
        const db = (await clientPromise).db();
        await db.collection('users').updateOne(
          { _id: new ObjectId(user.id) },
          { $set: { role: 'family' } },
        );
      } catch (err) {
        console.error('createUser role default failed:', err);
      }
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();
        if (!email || !password) return null;

        const db = (await clientPromise).db();
        const user = await db.collection('users').findOne({ email });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
          email: user.email,
          role: user.role || 'family',
        };
      },
    }),
  ],
});
