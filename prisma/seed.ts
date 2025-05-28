// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

// Create a new PrismaClient instance
const prisma = new PrismaClient();

async function main() {
  // Upsert means "insert if not exists, otherwise update" — safe to run multiple times
  await prisma.config.upsert({
    where: { key: "shared_password" },
    update: {}, // no changes if it already exists
    create: {
      key: "shared_password",
      value: "letmein", // 🔒 Replace with your actual shared password
    },
  });

  console.log("Seeded shared password.");
}

// Run the function and handle errors
main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
