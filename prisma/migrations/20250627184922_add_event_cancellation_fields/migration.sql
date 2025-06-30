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
    "isCanceled" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" DATETIME,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Event" ("ageRequired", "cost", "createdAt", "duration", "endDateTime", "eventType", "experienceRequired", "gameSystem", "id", "location", "materialsRequired", "priority", "shortDescription", "startDateTime", "ticketsAvailable", "title") SELECT "ageRequired", "cost", "createdAt", "duration", "endDateTime", "eventType", "experienceRequired", "gameSystem", "id", "location", "materialsRequired", "priority", "shortDescription", "startDateTime", "ticketsAvailable", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
