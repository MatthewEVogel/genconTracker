-- CreateTable
CREATE TABLE "registration_timer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL
);
