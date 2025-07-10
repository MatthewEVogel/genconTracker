-- CreateTable
CREATE TABLE "DesiredEvents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventsListId" TEXT NOT NULL,

    CONSTRAINT "DesiredEvents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesiredEvents_userId_eventsListId_key" ON "DesiredEvents"("userId", "eventsListId");

-- AddForeignKey
ALTER TABLE "DesiredEvents" ADD CONSTRAINT "DesiredEvents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
