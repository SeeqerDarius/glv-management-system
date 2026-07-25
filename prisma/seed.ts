import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const temporaryPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
  const adminPassword = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.upsert({
    where: {
      email: "rockfrostconsult@gmail.com",
    },
    update: {
      password: adminPassword,
      role: UserRole.ADMIN,
      mustChangePassword: true,
    },
    create: {
      name: "Andy",
      email: "rockfrostconsult@gmail.com",
      password: adminPassword,
      role: UserRole.ADMIN,
      mustChangePassword: true,
    },
  });

  console.log(`Owner account created. Temporary password: ${temporaryPassword}`);
  console.log("A password change is required at first login.");
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
