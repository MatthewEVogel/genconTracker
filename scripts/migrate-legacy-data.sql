-- Data migration script to move legacy purchased tickets to new schema
-- This script should be run after the schema migration is complete

-- Step 1: Migrate data from purchased_tickets to purchased_events
-- First, we need to find user IDs based on purchaser names in purchased_tickets
INSERT INTO "purchased_events" (
    "id",
    "userId", 
    "eventId",
    "recipient",
    "purchaseDate",
    "cost",
    "createdAt"
)
SELECT 
    pt."id",
    -- Match purchaser name to user
    (SELECT u."id" FROM "users" u 
     WHERE CONCAT(u."firstName", ' ', u."lastName") = pt."purchaser" 
     LIMIT 1) as "userId",
    pt."eventId",
    pt."recipient",
    pt."purchaseDate",
    -- Convert cost if it exists (currently no cost in purchased_tickets)
    NULL as "cost",
    pt."createdAt"
FROM "purchased_tickets" pt
WHERE EXISTS (
    SELECT 1 FROM "users" u 
    WHERE CONCAT(u."firstName", ' ', u."lastName") = pt."purchaser"
)
-- Only migrate tickets that haven't been refunded yet
AND pt."isRefunded" = false;

-- Step 2: Create refunded events for tickets that were already refunded
INSERT INTO "refunded_events" (
    "id",
    "userId",
    "eventId", 
    "recipient",
    "originalCost",
    "refundAmount",
    "purchaseDate",
    "refundDate",
    "refundReason",
    "createdAt"
)
SELECT 
    gen_random_uuid() as "id", -- Generate new ID for refunded events
    -- Match purchaser name to user
    (SELECT u."id" FROM "users" u 
     WHERE CONCAT(u."firstName", ' ', u."lastName") = pt."purchaser" 
     LIMIT 1) as "userId",
    pt."eventId",
    pt."recipient",
    NULL as "originalCost", -- No cost data in legacy table
    NULL as "refundAmount", -- No refund amount data in legacy table
    pt."purchaseDate",
    pt."createdAt" as "refundDate", -- Use createdAt as approximate refund date
    'Migrated from legacy system' as "refundReason",
    CURRENT_TIMESTAMP as "createdAt"
FROM "purchased_tickets" pt
WHERE EXISTS (
    SELECT 1 FROM "users" u 
    WHERE CONCAT(u."firstName", ' ', u."lastName") = pt."purchaser"
)
-- Only migrate tickets that were refunded
AND pt."isRefunded" = true;

-- Step 3: Verification queries (comment out for actual migration)
/*
-- Check migration results
SELECT 'purchased_events' as table_name, COUNT(*) as count FROM "purchased_events"
UNION ALL
SELECT 'refunded_events' as table_name, COUNT(*) as count FROM "refunded_events"
UNION ALL
SELECT 'purchased_tickets (total)' as table_name, COUNT(*) as count FROM "purchased_tickets"
UNION ALL
SELECT 'purchased_tickets (not refunded)' as table_name, COUNT(*) as count FROM "purchased_tickets" WHERE "isRefunded" = false
UNION ALL
SELECT 'purchased_tickets (refunded)' as table_name, COUNT(*) as count FROM "purchased_tickets" WHERE "isRefunded" = true;

-- Check for orphaned records (tickets without matching users)
SELECT pt."purchaser", COUNT(*) as ticket_count
FROM "purchased_tickets" pt
WHERE NOT EXISTS (
    SELECT 1 FROM "users" u 
    WHERE CONCAT(u."firstName", ' ', u."lastName") = pt."purchaser"
)
GROUP BY pt."purchaser";
*/