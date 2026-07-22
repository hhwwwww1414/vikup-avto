/**
 * Create the first ADMIN safely.
 *
 * Reads ADMIN_LOGIN, ADMIN_PASSWORD, ADMIN_NAME from the environment.
 * Idempotent: if the login already exists, it does NOT overwrite the password
 * (so re-running on every deploy is safe). Pass --reset-password to force a
 * password reset for an existing admin.
 *
 * Usage:
 *   ADMIN_LOGIN=admin ADMIN_PASSWORD=... ADMIN_NAME="Admin" npm run create-admin
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.ADMIN_LOGIN?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  const resetPassword = process.argv.includes("--reset-password");

  if (!login || !password) {
    console.error("ADMIN_LOGIN and ADMIN_PASSWORD must be set.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { login } });

  if (existing) {
    if (resetPassword) {
      await prisma.user.update({
        where: { login },
        data: { passwordHash: await bcrypt.hash(password, 10), role: "ADMIN", isActive: true },
      });
      console.log(`Admin "${login}" password reset.`);
    } else {
      console.log(`Admin "${login}" already exists — leaving unchanged.`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      name,
      login,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`Admin "${login}" created.`);
}

main()
  .catch((e) => {
    console.error("create-admin failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
