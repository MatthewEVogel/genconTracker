-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "eventType" TEXT,
    "gameSystem" TEXT,
    "startDateTime" TEXT,
    "duration" TEXT,
    "ageRequired" TEXT,
    "experienceRequired" TEXT,
    "materialsRequired" TEXT,
    "cost" TEXT,
    "location" TEXT,
    "ticketsAvailable" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
