// Import the PrismaClient from the generated Prisma package
import { PrismaClient } from "@prisma/client";

// Define a custom type for globalThis to include our Prisma instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined; // optional Prisma instance on global object
};

// Create (or reuse) a single PrismaClient instance
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(); // use existing or create new

// In development, store the PrismaClient on globalThis to reuse between reloads
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
