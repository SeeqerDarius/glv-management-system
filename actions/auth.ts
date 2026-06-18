"use server";

import { signIn, signOut, auth } from "@/lib/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
};

export type ChangePasswordState = {
  error?: string;
  success?: string;
};

export async function login(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Invalid email or password.",
      };
    }

    throw error;
  }

  return {};
}

export async function logout() {
  await signOut({
    redirectTo: "/login",
  });
}

export async function changePassword(
  _state: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return {
      error: "Current password and new password are required.",
    };
  }

  if (newPassword.length < 8) {
    return {
      error: "New password must be at least 8 characters.",
    };
  }

  if (newPassword === currentPassword) {
    return {
      error: "New password must be different from the current password.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const validPassword = await bcrypt.compare(currentPassword, user.password);

  if (!validPassword) {
    return {
      error: "Current password is incorrect.",
    };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  await signIn("credentials", {
    email: user.email,
    password: newPassword,
    redirectTo: "/dashboard",
  });

  return {
    success: "Password updated.",
  };
}
