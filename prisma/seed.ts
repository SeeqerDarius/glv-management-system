import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash(
    "Admin@2026",
    10
  );

  await prisma.user.upsert({
    where: {
      email: "admin@glv.com",
    },

    update: {
      role: UserRole.SUPER_ADMIN,
    },

    create: {
      name: "Andy",
      email: "admin@glv.com",
      password: adminPassword,
      role: UserRole.SUPER_ADMIN,
      mustChangePassword: false,
    },
  });

  await prisma.setting.upsert({
    where: {
      id: "glv-settings",
    },

    update: {},

    create: {
      id: "glv-settings",
      companyName: "God's Love Ventures",
      phone: "0598775671",
      address: "Ghana",
    },
  });

  console.log("GLV Admin Created");
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
