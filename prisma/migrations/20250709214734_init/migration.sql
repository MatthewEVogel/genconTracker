-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "googleId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "image" TEXT,
    "phoneNumber" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "textNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
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
    "canceledAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "buyingFor" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "cost" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsers" INTEGER NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "errors" TEXT NOT NULL,

    CONSTRAINT "CalculationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_timer" (
    "id" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "registration_timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasedEvents" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "purchaser" TEXT NOT NULL,

    CONSTRAINT "PurchasedEvents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEvent_userId_eventId_key" ON "UserEvent"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAssignment_userId_eventId_calculationId_key" ON "TicketAssignment"("userId", "eventId", "calculationId");

-- CreateIndex
CREATE INDEX "PurchasedEvents_eventId_idx" ON "PurchasedEvents"("eventId");

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "CalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
