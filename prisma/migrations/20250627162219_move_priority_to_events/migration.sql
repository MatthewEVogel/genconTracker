/*
  Warnings:

  - You are about to drop the column `priority` on the `UserEvent` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "eventType" TEXT,
    "gameSystem" TEXT,
    "startDateTime" TEXT,
    "duration" TEXT,
    "endDateTime" TEXT,
    "ageRequired" TEXT,
    "experienceRequired" TEXT,
    "materialsRequired" TEXT,
    "cost" TEXT,
    "location" TEXT,
    "ticketsAvailable" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Event" ("ageRequired", "cost", "createdAt", "duration", "endDateTime", "eventType", "experienceRequired", "gameSystem", "id", "location", "materialsRequired", "shortDescription", "startDateTime", "ticketsAvailable", "title") SELECT "ageRequired", "cost", "createdAt", "duration", "endDateTime", "eventType", "experienceRequired", "gameSystem", "id", "location", "materialsRequired", "shortDescription", "startDateTime", "ticketsAvailable", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_UserEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserEvent" ("createdAt", "eventId", "id", "updatedAt", "userId") SELECT "createdAt", "eventId", "id", "updatedAt", "userId" FROM "UserEvent";
DROP TABLE "UserEvent";
ALTER TABLE "new_UserEvent" RENAME TO "UserEvent";
CREATE UNIQUE INDEX "UserEvent_userId_eventId_key" ON "UserEvent"("userId", "eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
