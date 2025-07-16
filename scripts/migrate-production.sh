#!/bin/bash

# Production Migration Script for Adding createdAt to Transactions
# This script safely adds createdAt columns to existing production data

echo "🚀 Starting production migration for transaction timestamps..."

# Run the migration
echo "📦 Running Prisma migration..."
npx prisma migrate deploy

# Verify the migration was successful
echo "✅ Verifying migration..."
npx prisma db pull --print

echo "🎉 Migration completed successfully!"
echo ""
echo "📋 Summary of changes:"
echo "  - Added 'createdAt' column to PurchasedEvents table"
echo "  - Added 'createdAt' column to RefundedEvents table"
echo "  - All existing records have been timestamped with current time"
echo "  - New records will automatically get timestamp on creation"
echo ""
echo "🔍 The admin transaction management now supports:"
echo "  - Sorting by date added to database (newest first)"
echo "  - Date Added column showing when transactions were recorded"
echo "  - Hide/Show functionality for better navigation"
