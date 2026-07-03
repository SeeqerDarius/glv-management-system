import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { touchUserPresence } from "@/lib/presence";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      name: "credentials",

      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        if (!credentials) return null;

        const email = String(credentials.email ?? "").trim().toLowerCase();
        const password = String(credentials.password ?? "");

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            staff: true,
          },
        });

        if (!user) return null;
        if (user.role === "STAFF" && !user.staff?.active) return null;

        const validPassword = await bcrypt.compare(
          password,
          user.password
        );

        if (!validPassword) return null;

        await touchUserPresence(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          staffId: user.staffId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
});
