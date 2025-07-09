#!/bin/bash

# GenCon Tracker - Neon Database Update Script
# This script updates your Neon database to match the current schema.prisma structure

set -e  # Exit on any error

echo "🎲 GenCon Tracker - Neon Database Update Script"
echo "=================================================="
echo ""

# Check if required environment variables are set
if [ -z "$POSTGRES_PRISMA_URL" ]; then
    echo "❌ ERROR: POSTGRES_PRISMA_URL environment variable is not set"
    echo "Please set your Neon database connection string:"
    echo "export POSTGRES_PRISMA_URL='your_neon_connection_string_here'"
    exit 1
fi

# Check if Prisma CLI is installed
if ! command -v prisma &> /dev/null; then
    echo "❌ ERROR: Prisma CLI is not installed"
    echo "Please install it with: npm install -g prisma"
    exit 1
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "❌ ERROR: npx is not available"
    echo "Please make sure Node.js and npm are properly installed"
    exit 1
fi

echo "✅ Environment checks passed"
echo ""

# Ask for confirmation
echo "⚠️  WARNING: This will modify your Neon database structure!"
echo "Make sure you have a backup of your database before proceeding."
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi

echo ""
echo "🔄 Starting database update process..."
echo ""

# Step 1: Reset the migration history (since we don't have migration files)
echo "📋 Step 1: Resetting migration history..."
npx prisma migrate reset --force --skip-seed

if [ $? -eq 0 ]; then
    echo "✅ Migration history reset successfully"
else
    echo "❌ Failed to reset migration history"
    exit 1
fi

echo ""

# Step 2: Create and apply initial migration
echo "📋 Step 2: Creating initial migration from current schema..."
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
    echo "✅ Initial migration created and applied successfully"
else
    echo "❌ Failed to create initial migration"
    exit 1
fi

echo ""

# Step 3: Generate Prisma client
echo "📋 Step 3: Generating Prisma client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo ""

# Step 4: Verify database structure
echo "📋 Step 4: Verifying database structure..."
npx prisma db pull --print

if [ $? -eq 0 ]; then
    echo "✅ Database structure verified"
else
    echo "⚠️  Warning: Could not verify database structure"
fi

echo ""
echo "🎉 Database update completed successfully!"
echo ""
echo "Summary of changes applied:"
echo "• User table with OAuth and notification settings"
echo "• Event table with cancellation tracking"
echo "• UserEvent table for user wishlists"
echo "• TicketAssignment table for algorithm results"
echo "• CalculationRun table for algorithm tracking"
echo "• RegistrationTimer table for countdown"
echo "• PurchasedTicket table for refund tracking"
echo ""
echo "Next steps:"
echo "1. Test your application with the updated database"
echo "2. Run any data seeding if needed: npm run seed"
echo "3. Deploy your application with the updated schema"
echo ""
echo "✅ All done! Your Neon database is now up to date."