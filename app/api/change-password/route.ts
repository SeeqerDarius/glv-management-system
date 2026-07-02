import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";

function changePasswordRedirect(error: string) {
  redirect(`/change-password?error=${error}`);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  const formData = await request.formData();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    changePasswordRedirect("missing-fields");
  }

  if (newPassword !== confirmPassword) {
    changePasswordRedirect("password-mismatch");
  }

  if (newPassword.length < 8) {
    changePasswordRedirect("password-too-short");
  }

  if (newPassword === currentPassword) {
    changePasswordRedirect("password-unchanged");
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
    changePasswordRedirect("invalid-current-password");
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

  await clearAuthCookies();
  redirect("/login?passwordChanged=1");
}
