-- Refactor to 5-table schema with proper naming and new tables

-- Step 1: Rename existing tables to match new schema naming convention
ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "Event" RENAME TO "events";
ALTER TABLE "UserEvent" RENAME TO "desired_events";
ALTER TABLE "CalculationRun" RENAME TO "calculation_runs";
ALTER TABLE "TicketAssignment" RENAME TO "ticket_assignments";
ALTER TABLE "PurchasedTicket" RENAME TO "purchased_tickets";

-- Step 2: Update Event table schema to match new requirements
-- Add updatedAt column to users if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update Event table data types
-- Note: startDateTime and endDateTime are currently stored as strings, need to convert to TIMESTAMP
-- First, let's add the new columns with different names, then migrate data
ALTER TABLE "events" ADD COLUMN "startDateTime_new" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "endDateTime_new" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "cost_new" DECIMAL(10,2);

-- Convert string dates to timestamps where possible
-- Handle various date formats that might exist
UPDATE "events" 
SET "startDateTime_new" = CASE 
    WHEN "startDateTime" IS NOT NULL AND "startDateTime" != '' 
    THEN CASE
        -- Try ISO 8601 format first
        WHEN "startDateTime" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' 
        THEN "startDateTime"::TIMESTAMP
        -- Try standard format
        WHEN "startDateTime" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' 
        THEN "startDateTime"::TIMESTAMP
        ELSE NULL
    END
    ELSE NULL 
END;

UPDATE "events" 
SET "endDateTime_new" = CASE 
    WHEN "endDateTime" IS NOT NULL AND "endDateTime" != '' 
    THEN CASE
        -- Try ISO 8601 format first
        WHEN "endDateTime" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' 
        THEN "endDateTime"::TIMESTAMP
        -- Try standard format
        WHEN "endDateTime" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' 
        THEN "endDateTime"::TIMESTAMP
        ELSE NULL
    END
    ELSE NULL 
END;

-- Convert cost from string to decimal where possible
UPDATE "events" 
SET "cost_new" = CASE 
    WHEN "cost" IS NOT NULL AND "cost" ~ '^[0-9]+\.?[0-9]*$' 
    THEN "cost"::DECIMAL(10,2)
    ELSE NULL 
END;

-- Drop old columns and rename new ones
ALTER TABLE "events" DROP COLUMN "startDateTime";
ALTER TABLE "events" DROP COLUMN "endDateTime";
ALTER TABLE "events" DROP COLUMN "cost";
ALTER TABLE "events" RENAME COLUMN "startDateTime_new" TO "startDateTime";
ALTER TABLE "events" RENAME COLUMN "endDateTime_new" TO "endDateTime";
ALTER TABLE "events" RENAME COLUMN "cost_new" TO "cost";

-- Step 3: Update desired_events table structure
-- Add missing columns to desired_events (formerly UserEvent)
ALTER TABLE "desired_events" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "desired_events" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Step 4: Create new tables for purchased_events and refunded_events
CREATE TABLE "purchased_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost" DECIMAL(10,2),
    "confirmation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchased_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refunded_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "originalCost" DECIMAL(10,2),
    "refundAmount" DECIMAL(10,2),
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundReason" TEXT,
    "confirmation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunded_events_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create indexes for new tables
CREATE INDEX "purchased_events_eventId_idx" ON "purchased_events"("eventId");
CREATE INDEX "purchased_events_userId_idx" ON "purchased_events"("userId");
CREATE INDEX "refunded_events_eventId_idx" ON "refunded_events"("eventId");
CREATE INDEX "refunded_events_userId_idx" ON "refunded_events"("userId");

-- Step 6: Add foreign key constraints for new tables
ALTER TABLE "purchased_events" ADD CONSTRAINT "purchased_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchased_events" ADD CONSTRAINT "purchased_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunded_events" ADD CONSTRAINT "refunded_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunded_events" ADD CONSTRAINT "refunded_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Update foreign key references in existing tables to point to renamed tables
ALTER TABLE "desired_events" DROP CONSTRAINT IF EXISTS "UserEvent_userId_fkey";
ALTER TABLE "desired_events" DROP CONSTRAINT IF EXISTS "UserEvent_eventId_fkey";
ALTER TABLE "desired_events" ADD CONSTRAINT "desired_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "desired_events" ADD CONSTRAINT "desired_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_assignments" DROP CONSTRAINT IF EXISTS "TicketAssignment_userId_fkey";
ALTER TABLE "ticket_assignments" DROP CONSTRAINT IF EXISTS "TicketAssignment_eventId_fkey";
ALTER TABLE "ticket_assignments" DROP CONSTRAINT IF EXISTS "TicketAssignment_calculationId_fkey";
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: We keep purchased_tickets as legacy table for now, will migrate data later