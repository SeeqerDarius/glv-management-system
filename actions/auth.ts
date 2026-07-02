"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";

export type LoginState = {
  error?: string;
};

export type ForgotPasswordState = {
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

export async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return {
      error: "Enter the email address on your GLV staff account.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      role: true,
      staffId: true,
    },
  });

  if (user) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUEST",
        entity: "User",
        entityId: user.id,
        newValue: JSON.stringify({
          email: user.email,
          role: user.role,
          staffId: user.staffId,
          requestedAt: new Date().toISOString(),
        }),
      },
    });
  }

  return {
    success:
      "If this email belongs to a GLV account, a reset request has been recorded. Please contact an admin for a one-time password.",
  };
}
