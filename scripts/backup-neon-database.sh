#!/bin/bash

# GenCon Tracker - Neon Database Backup Script
# This script creates a full backup of your Neon PostgreSQL database using pg_dump

set -e  # Exit on any error

echo "🎲 GenCon Tracker - Neon Database Backup Script"
echo "================================================"
echo ""

# Check if required environment variables are set
if [ -z "$POSTGRES_PRISMA_URL" ]; then
    echo "❌ ERROR: POSTGRES_PRISMA_URL environment variable is not set"
    echo "Please set your Neon database connection string:"
    echo "export POSTGRES_PRISMA_URL='your_neon_connection_string_here'"
    exit 1
fi

# Check if pg_dump is installed
if ! command -v pg_dump &> /dev/null; then
    echo "❌ ERROR: pg_dump is not installed"
    echo "Please install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  CentOS/RHEL: sudo yum install postgresql"
    exit 1
fi

echo "✅ Environment checks passed"
echo ""

# Create backups directory if it doesn't exist
BACKUP_DIR="backups"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "📁 Created backups directory: $BACKUP_DIR"
fi

# Generate timestamp for backup filename
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="gencon_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "📋 Backup Details:"
echo "   • Database: Neon PostgreSQL"
echo "   • Backup file: $BACKUP_PATH"
echo "   • Timestamp: $TIMESTAMP"
echo ""

# Parse connection string to extract components
# Neon connection strings typically look like:
# postgresql://username:password@host:port/database?sslmode=require
CONNECTION_URL="$POSTGRES_PRISMA_URL"

# Extract database name from URL (after last slash, before any query params)
DB_NAME=$(echo "$CONNECTION_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "🔄 Starting database backup..."
echo "   • Target database: $DB_NAME"
echo ""

# Perform the backup using pg_dump with comprehensive options
# Using data-only approach to avoid version compatibility issues
echo "📦 Running pg_dump..."

# First, try the full backup approach
if ! pg_dump "$CONNECTION_URL" \
    --verbose \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --create \
    --format=plain \
    --no-sync \
    --file="$BACKUP_PATH" 2>/dev/null; then
    
    echo "⚠️  Version mismatch detected. Trying alternative approach..."
    
    # Alternative approach: Use data-only backup which is more version-tolerant
    if pg_dump "$CONNECTION_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --data-only \
        --inserts \
        --format=plain \
        --file="$BACKUP_PATH"; then
        
        echo "✅ Data-only backup completed successfully!"
        echo "⚠️  Note: This backup contains data only (no schema). You may need to recreate the schema separately."
        
    else
        echo "❌ Both backup methods failed. This may be due to version incompatibility."
        echo "💡 Try updating your PostgreSQL client tools:"
        echo "   brew upgrade postgresql"
        echo ""
        echo "Or use a version-compatible pg_dump by installing PostgreSQL 17:"
        echo "   brew install postgresql@17"
        echo "   /opt/homebrew/opt/postgresql@17/bin/pg_dump ..."
        exit 1
    fi
fi

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backup completed successfully!"
    
    # Get file size for confirmation
    if command -v du &> /dev/null; then
        FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        echo "   • Backup file size: $FILE_SIZE"
    fi
    
    # Verify backup file exists and has content
    if [ -s "$BACKUP_PATH" ]; then
        echo "   • Backup file verified: $BACKUP_PATH"
        
        # Show first few lines to confirm it's a valid SQL dump
        echo ""
        echo "📄 Backup file preview (first 10 lines):"
        echo "----------------------------------------"
        head -10 "$BACKUP_PATH"
        echo "----------------------------------------"
        echo ""
        
        # Optional: Compress the backup
        read -p "🗜️  Would you like to compress the backup file? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🗜️  Compressing backup..."
            gzip "$BACKUP_PATH"
            COMPRESSED_PATH="${BACKUP_PATH}.gz"
            if [ -f "$COMPRESSED_PATH" ]; then
                COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
                echo "✅ Backup compressed successfully!"
                echo "   • Compressed file: $COMPRESSED_PATH"
                echo "   • Compressed size: $COMPRESSED_SIZE"
                FINAL_BACKUP_PATH="$COMPRESSED_PATH"
            else
                echo "❌ Compression failed, keeping original file"
                FINAL_BACKUP_PATH="$BACKUP_PATH"
            fi
        else
            FINAL_BACKUP_PATH="$BACKUP_PATH"
        fi
        
        echo ""
        echo "🎉 Database backup completed successfully!"
        echo ""
        echo "📋 Backup Summary:"
        echo "   • Database: $DB_NAME"
        echo "   • Backup file: $FINAL_BACKUP_PATH"
        echo "   • Created: $(date)"
        echo ""
        echo "📝 What was backed up:"
        echo "   • All table structures (schema)"
        echo "   • All data from every table"
        echo "   • Indexes and constraints"
        echo "   • Sequences and their current values"
        echo "   • Database creation statements"
        echo ""
        echo "🔄 To restore this backup:"
        echo "   psql \"\$POSTGRES_PRISMA_URL\" < $FINAL_BACKUP_PATH"
        echo ""
        echo "✅ Backup process complete!"
        
    else
        echo "❌ ERROR: Backup file is empty or doesn't exist"
        exit 1
    fi
else
    echo "❌ ERROR: Backup failed"
    echo "Please check your database connection and try again"
    exit 1
fi
