import type { DefaultSession } from "next-auth";
import type { UserPermission, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    permissions?: UserPermission[];
    staffId?: string | null;
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
  }

  interface Session {
    user: {
      id?: string;
      role?: UserRole;
      permissions?: UserPermission[];
      staffId?: string | null;
      mustChangePassword?: boolean;
      twoFactorEnabled?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    permissions?: UserPermission[];
    staffId?: string | null;
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
  }
}
