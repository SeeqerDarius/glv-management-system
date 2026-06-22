import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin@2026", 10);

  await prisma.user.upsert({
    where: {
      email: "admin@glv.com",
    },
    update: {
      password: adminPassword,
      role: UserRole.ADMIN,
      mustChangePassword: false,
    },
    create: {
      name: "Andy",
      email: "admin@glv.com",
      password: adminPassword,
      role: UserRole.ADMIN,
      mustChangePassword: false,
    },
  });

  console.log("Admin password reset to Admin@2026");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });