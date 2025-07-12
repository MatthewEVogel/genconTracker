/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventTicketAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventsListEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DesiredEvents" DROP CONSTRAINT "DesiredEvents_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventTicketAssignment" DROP CONSTRAINT "EventTicketAssignment_calculationId_fkey";

-- DropForeignKey
ALTER TABLE "EventTicketAssignment" DROP CONSTRAINT "EventTicketAssignment_eventsListId_fkey";

-- DropForeignKey
ALTER TABLE "EventTicketAssignment" DROP CONSTRAINT "EventTicketAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventsListEvent" DROP CONSTRAINT "EventsListEvent_eventsListId_fkey";

-- DropForeignKey
ALTER TABLE "EventsListEvent" DROP CONSTRAINT "EventsListEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "TicketAssignment" DROP CONSTRAINT "TicketAssignment_calculationId_fkey";

-- DropForeignKey
ALTER TABLE "TicketAssignment" DROP CONSTRAINT "TicketAssignment_eventId_fkey";

-- DropForeignKey
ALTER TABLE "TicketAssignment" DROP CONSTRAINT "TicketAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserEvent" DROP CONSTRAINT "UserEvent_eventId_fkey";

-- DropForeignKey
ALTER TABLE "UserEvent" DROP CONSTRAINT "UserEvent_userId_fkey";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "EventTicketAssignment";

-- DropTable
DROP TABLE "EventsListEvent";

-- DropTable
DROP TABLE "TicketAssignment";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserEvent";

-- CreateTable
CREATE TABLE "RefundedEvents" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    CONSTRAINT "RefundedEvents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserList" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "genConName" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "googleId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "image" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundedEvents_userName_idx" ON "RefundedEvents"("userName");

-- CreateIndex
CREATE INDEX "RefundedEvents_ticketId_idx" ON "RefundedEvents"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundedEvents_userName_ticketId_key" ON "RefundedEvents"("userName", "ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "UserList_email_key" ON "UserList"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserList_googleId_key" ON "UserList"("googleId");

-- AddForeignKey
ALTER TABLE "DesiredEvents" ADD CONSTRAINT "DesiredEvents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundedEvents" ADD CONSTRAINT "RefundedEvents_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PurchasedEvents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
