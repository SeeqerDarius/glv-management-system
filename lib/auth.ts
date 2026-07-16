import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { normalizeOwnerRole } from "@/lib/owner";
import { touchUserPresence } from "@/lib/presence";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user?.email && params.user.role) {
        token.email = params.user.email;
        token.role = normalizeOwnerRole(params.user.email, params.user.role);
      }

      if (
        !params.user &&
        typeof token.id !== "string" &&
        typeof token.email === "string"
      ) {
        const user = await prisma.user.findUnique({
          where: {
            email: token.email,
          },
          select: {
            id: true,
            email: true,
            role: true,
            permissions: true,
            staffId: true,
            mustChangePassword: true,
          },
        });

        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.role = normalizeOwnerRole(user.email, user.role);
          token.permissions = user.permissions;
          token.staffId = user.staffId;
          token.mustChangePassword = user.mustChangePassword;
        }
      }

      if (!params.user && typeof token.id === "string") {
        const freshUser = await prisma.user.findUnique({
          where: {
            id: token.id,
          },
          select: {
            email: true,
            role: true,
            permissions: true,
            staffId: true,
            mustChangePassword: true,
          },
        });

        if (freshUser) {
          token.email = freshUser.email;
          token.role = normalizeOwnerRole(freshUser.email, freshUser.role);
          token.permissions = freshUser.permissions;
          token.staffId = freshUser.staffId;
          token.mustChangePassword = freshUser.mustChangePassword;
        }
      }

      return token;
    },
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
          role: normalizeOwnerRole(user.email, user.role),
          permissions: user.permissions,
          staffId: user.staffId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
});
