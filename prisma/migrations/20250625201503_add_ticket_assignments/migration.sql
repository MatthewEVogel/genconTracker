-- CreateTable
CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "buyingFor" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "cost" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketAssignment_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "CalculationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalculationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsers" INTEGER NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "errors" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketAssignment_userId_eventId_calculationId_key" ON "TicketAssignment"("userId", "eventId", "calculationId");
