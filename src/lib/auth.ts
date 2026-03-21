// ---------------------------------------------------------------------------
// Auth.js (NextAuth v5) configuration
//
// Google OAuth for sign-in only — we do NOT request calendar.events scope.
// Calendar sync is handled via the iCal feed (no OAuth needed).
// ---------------------------------------------------------------------------

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;

      // Upsert the user row. On first sign-in, generate a calendar token.
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing.length === 0) {
        const calendarToken = randomBytes(32).toString("hex");
        await db.insert(users).values({
          email: user.email,
          name: user.name ?? null,
          calendarToken,
        });
      }

      return true;
    },

    async session({ session }) {
      if (!session.user?.email) return session;

      const [dbUser] = await db
        .select({ id: users.id, calendarToken: users.calendarToken })
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);

      if (dbUser) {
        // Extend the session with the DB user ID and calendar token.
        (session.user as typeof session.user & { id: string; calendarToken: string }).id =
          dbUser.id;
        (session.user as typeof session.user & { id: string; calendarToken: string }).calendarToken =
          dbUser.calendarToken;
      }

      return session;
    },
  },
});
