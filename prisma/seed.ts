import "dotenv/config";
import { prisma } from "../src/config/prisma";
import { hashData } from "../src/utils/hash";

async function main() {
  console.log("Seeding database with default accounts...");

  const defaultPassword = await hashData("admin123");

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin1@gmail.com" },
    update: { role: "ADMIN" },
    create: {
      name: "Admin One",
      email: "admin1@gmail.com",
      password: defaultPassword,
      role: "ADMIN",
    },
  });
  console.log(`✓ Admin user created/updated: ${admin.email} (Role: ${admin.role})`);

  // Theater Owner user
  const owner = await prisma.user.upsert({
    where: { email: "owner1@gmail.com" },
    update: { role: "THEATER_OWNER" },
    create: {
      name: "Cinema Owner",
      email: "owner1@gmail.com",
      password: defaultPassword,
      role: "THEATER_OWNER",
    },
  });
  console.log(`✓ Theater Owner user created/updated: ${owner.email} (Role: ${owner.role})`);

  // Normal User
  const user = await prisma.user.upsert({
    where: { email: "user1@gmail.com" },
    update: { role: "USER" },
    create: {
      name: "Movie Fan",
      email: "user1@gmail.com",
      password: defaultPassword,
      role: "USER",
    },
  });
  console.log(`✓ Normal user created/updated: ${user.email} (Role: ${user.role})`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

