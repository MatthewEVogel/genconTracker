-- CreateTable
CREATE TABLE "PurchasedTicket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "purchaser" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsRefund" BOOLEAN NOT NULL DEFAULT false,
    "isRefunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasedTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchasedTicket_eventId_idx" ON "PurchasedTicket"("eventId");
