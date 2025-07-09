-- CreateTable
CREATE TABLE "DesiredEvents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "DesiredEvents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesiredEvents_userId_eventId_key" ON "DesiredEvents"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "DesiredEvents" ADD CONSTRAINT "DesiredEvents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesiredEvents" ADD CONSTRAINT "DesiredEvents_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
