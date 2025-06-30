# Vercel Deployment Guide for GenCon Tracker

## Prerequisites
Your application is now configured for PostgreSQL instead of SQLite to work with Vercel's serverless environment.

## Step 1: Set Up a PostgreSQL Database

Choose one of these options:

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Select your project
3. Go to the "Storage" tab
4. Click "Create Database" → "Postgres"
5. Follow the setup wizard
6. Copy the connection string provided

### Option B: Neon (Free PostgreSQL)
1. Go to https://neon.tech
2. Sign up for a free account
3. Create a new project
4. Copy the connection string from the dashboard

### Option C: Supabase (Free PostgreSQL)
1. Go to https://supabase.com
2. Sign up for a free account
3. Create a new project
4. Go to Settings → Database
5. Copy the connection string

## Step 2: Configure Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your GenCon Tracker project
3. Go to Settings → Environment Variables
4. Add the following variables:

### Required Environment Variables:

```
DATABASE_URL
Value: [Your PostgreSQL connection string from Step 1]

NEXTAUTH_SECRET
Value: [Generate a secure random string - you can use: openssl rand -base64 32]

NEXTAUTH_URL
Value: https://[your-vercel-domain].vercel.app

GOOGLE_CLIENT_ID
Value: [Your Google Client ID from Google Cloud Console]

GOOGLE_CLIENT_SECRET
Value: [Your Google Client Secret from Google Cloud Console]
```

**Important**: Make sure to set these for "Production" environment.

## Step 3: Update Google OAuth Settings

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID
4. Add your Vercel domain to "Authorized JavaScript origins":
   - `https://[your-vercel-domain].vercel.app`
5. Add the callback URL to "Authorized redirect URIs":
   - `https://[your-vercel-domain].vercel.app/api/auth/callback/google`

## Step 4: Deploy and Initialize Database

1. Push your latest code to GitHub (the schema is now updated for PostgreSQL)
2. Vercel will automatically redeploy
3. The postbuild script will automatically run database migrations during deployment

## Step 5: Test the Deployment

1. Visit your Vercel URL
2. Try signing in with Google
3. The database should now work properly

## Troubleshooting

### If you get database connection errors:
- Verify the DATABASE_URL is correct in Vercel environment variables
- Make sure the database allows connections from Vercel's IP ranges
- Check that the database is running and accessible

### If Google OAuth doesn't work:
- Verify the redirect URIs are correctly set in Google Cloud Console
- Check that NEXTAUTH_URL matches your actual Vercel domain
- Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly

### If you need to manually run migrations:
```bash
npx vercel env pull .env.local
npx prisma migrate deploy
npx prisma generate
```

## Database Schema Migration

The application has been updated from SQLite to PostgreSQL. The main changes:
- Database provider changed from "sqlite" to "postgresql"
- All existing functionality remains the same
- Better performance and scalability for production use

## Security Notes

- Never commit environment files with secrets to git
- Environment variables are securely stored in Vercel
- Database credentials are encrypted in transit
- Google OAuth provides secure authentication
- Use strong, unique secrets for production
