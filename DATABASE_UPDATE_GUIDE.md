# Database Update Guide for Neon

This guide helps you update your Neon database to match your current schema.prisma structure after rolling back to an earlier commit.

## 🚨 Important: Backup Your Database First!

Before running any database updates, **create a backup of your Neon database**:

### Option 1: Using Neon Dashboard
1. Go to your [Neon Console](https://console.neon.tech/)
2. Select your project
3. Navigate to "Branches" 
4. Create a new branch from your main branch (this creates a copy)
5. Name it something like "backup-before-schema-update"

### Option 2: Using pg_dump (if you have PostgreSQL tools)
```bash
# Replace with your actual Neon connection string
pg_dump "your_neon_connection_string" > neon_backup.sql
```

## 📋 Prerequisites

1. **Node.js and npm** installed
2. **Prisma CLI** installed: `npm install -g prisma`
3. **Environment variable** set with your Neon connection string:
   ```bash
   export POSTGRES_PRISMA_URL="postgres://neondb_owner:npg_OgKm7pCH0EYD@ep-little-wildflower-a4dtrb3k-pooler.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require"
   ```

## 🚀 Running the Update Script

### Step 1: Make the script executable
```bash
chmod +x update-neon-database.sh
```

### Step 2: Run the script
```bash
./update-neon-database.sh
```

### Step 3: Follow the prompts
- The script will check your environment
- It will ask for confirmation before making changes
- It will reset migration history and create a fresh migration
- It will generate the Prisma client
- It will verify the database structure

## 🔄 What the Script Does

1. **Environment Check**: Validates that required tools and environment variables are set
2. **Migration Reset**: Clears existing migration history (since you rolled back commits)
3. **Fresh Migration**: Creates a new migration from your current schema.prisma
4. **Client Generation**: Updates the Prisma client to match your schema
5. **Verification**: Checks that the database structure is correct

## 📊 Database Schema Being Applied

The script will create/update these tables in your Neon database:

- **User** - User accounts with OAuth and notification settings
- **Event** - GenCon events with cancellation tracking
- **UserEvent** - Many-to-many relationship for user wishlists
- **TicketAssignment** - Results from ticket assignment algorithm
- **CalculationRun** - Tracking for algorithm calculations
- **RegistrationTimer** - Admin-configurable registration countdown
- **PurchasedTicket** - Purchased tickets with refund tracking

## 🔧 Manual Alternative

If you prefer to run the commands manually:

```bash
# 1. Reset migration history
npx prisma migrate reset --force --skip-seed

# 2. Create fresh migration from current schema
npx prisma migrate dev --name init

# 3. Generate Prisma client
npx prisma generate

# 4. Verify database structure
npx prisma db pull --print
```

## 🛠️ Troubleshooting

### Connection Issues
- Verify your `POSTGRES_PRISMA_URL` is correct
- Check that your Neon database is running
- Ensure your IP is allowed (Neon usually allows all IPs by default)

### Migration Errors
- If you get conflicts, your database might have data that conflicts with the new schema
- Consider manually dropping conflicting tables or data before running the script

### Permission Errors
- Make sure your Neon user has CREATE/DROP permissions
- Check that you're connecting to the correct database

## 🧪 Testing After Update

1. **Start your application**: `npm run dev`
2. **Test basic functionality**: 
   - User login/registration
   - Event browsing
   - Wishlist management
3. **Check database with Prisma Studio**: `npx prisma studio`
4. **Run any data seeding**: `npm run seed`

## 🔒 Security Notes

- Never commit your `POSTGRES_PRISMA_URL` to version control
- Use environment variables for database credentials
- Consider using different databases for development and production
- Always backup before major schema changes

## 🆘 Recovery Instructions

If something goes wrong:

1. **Stop the script immediately** (Ctrl+C)
2. **Restore from backup**:
   - If using Neon branches: Reset your main branch to the backup branch
   - If using pg_dump: `psql "your_neon_connection_string" < neon_backup.sql`
3. **Check your code** for any issues in schema.prisma
4. **Try the update again** after fixing any issues

## 📞 Support

If you encounter issues:
1. Check the error messages carefully
2. Verify your schema.prisma syntax
3. Ensure all environment variables are set correctly
4. Consider reaching out to Neon support for database-specific issues