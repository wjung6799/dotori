import Google from 'next-auth/providers/google';

// Edge-safe Auth.js config, shared by middleware (which runs on the edge) and
// the full Node.js config in auth.js. It must NOT import the MongoDB adapter,
// bcrypt, or the Credentials provider (those pull in Node-only modules).
// Google (pure OAuth) is edge-safe, so it lives here.
const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  callbacks: {
    // Persist id + role (and name) onto the JWT.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'family';
        if (user.name) token.name = user.name;
      }
      return token;
    },
    // Expose id + role (and name) on the client session.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? 'family';
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
    // Runs in middleware for matched routes (see middleware.js). Returning false
    // redirects unauthenticated users to pages.signIn.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      if (path.startsWith('/admin')) {
        if (!isLoggedIn) return false;
        if (auth.user.role !== 'admin') {
          return Response.redirect(new URL('/login', nextUrl));
        }
        return true;
      }

      if (path.startsWith('/tutor')) {
        if (!isLoggedIn) return false;
        if (auth.user.role !== 'tutor' && auth.user.role !== 'admin') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }

      if (path.startsWith('/profile') || path.startsWith('/dashboard')) {
        return isLoggedIn;
      }

      return true;
    },
  },
};

export default authConfig;
