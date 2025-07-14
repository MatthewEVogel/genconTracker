#!/bin/bash

echo "Starting deployment process..."

# Run type checking
echo "Running type check..."
npm run typecheck

# Build the Next.js app
echo "Building Next.js app..."
npm run build

# Try to sync the database schema
echo "Syncing database schema..."
if npx prisma db push; then
    echo "Database schema synced successfully"
else
    echo "Warning: Database schema sync failed, trying to generate client anyway..."
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "Deployment process completed!"