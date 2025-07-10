-- CreateTable
CREATE TABLE "EventsList" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "eventType" TEXT,
    "gameSystem" TEXT,
    "startDateTime" TEXT,
    "endDateTime" TEXT,
    "ageRequired" TEXT,
    "experienceRequired" TEXT,
    "materialsRequired" TEXT,
    "cost" TEXT,
    "location" TEXT,
    "ticketsAvailable" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isCanceled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventsList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventsListEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventsListId" TEXT NOT NULL,

    CONSTRAINT "EventsListEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTicketAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventsListId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "buyingFor" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "cost" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventsListEvent_userId_eventsListId_key" ON "EventsListEvent"("userId", "eventsListId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTicketAssignment_userId_eventsListId_calculationId_key" ON "EventTicketAssignment"("userId", "eventsListId", "calculationId");

-- AddForeignKey
ALTER TABLE "EventsListEvent" ADD CONSTRAINT "EventsListEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventsListEvent" ADD CONSTRAINT "EventsListEvent_eventsListId_fkey" FOREIGN KEY ("eventsListId") REFERENCES "EventsList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketAssignment" ADD CONSTRAINT "EventTicketAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketAssignment" ADD CONSTRAINT "EventTicketAssignment_eventsListId_fkey" FOREIGN KEY ("eventsListId") REFERENCES "EventsList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketAssignment" ADD CONSTRAINT "EventTicketAssignment_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "CalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
