import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';

import clientPromise from '@/lib/mongodb';
import authConfig from '@/auth.config';

// Full Auth.js config (Node.js runtime — used by the /api/auth/[...nextauth]
// route handler). Extends the edge-safe base with the MongoDB adapter and the
// email/password Credentials provider. JWT session strategy is required so the
// Credentials provider works alongside the adapter.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' },
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
