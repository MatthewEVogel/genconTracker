# Production Deployment Guide - GenCon Tracker

## 🚨 Current Issue: Production 500 Errors

The local development environment works perfectly, but the production deployment on Vercel is failing with 500 errors during authentication and API calls.

## 🔍 Root Cause Analysis

Based on testing, the production issues are likely caused by:

1. **Database Migration Issues** - The new 5-table schema may not be properly deployed to production
2. **Environment Variables** - Missing or incorrect production environment variables
3. **Prisma Client Generation** - Client may not be properly generated in Vercel's build process
4. **Serverless Function Limitations** - Memory or timeout issues with the new consolidated services

## 🛠️ Step-by-Step Fix

### Step 1: Verify Environment Variables in Vercel

Go to your Vercel dashboard → Project Settings → Environment Variables and ensure these are set:

```bash
# Database
POSTGRES_PRISMA_URL=postgresql://username:password@host/database

# NextAuth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://gencon-tracker.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Notifications
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=your-email
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number
```

### Step 2: Update Build Configuration

The current `vercel.json` needs to be enhanced for the new architecture:

```json
{
  "build": {
    "env": {
      "ENABLE_PRISMA_GENERATE": "true"
    }
  },
  "functions": {
    "pages/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### Step 3: Fix Build Process

Update `package.json` to ensure proper build order:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postbuild": "prisma migrate deploy",
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### Step 4: Database Migration to Production

Run these commands to ensure your production database has the latest schema:

```bash
# Set production database URL
export DATABASE_URL="your-production-postgres-url"

# Deploy migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Verify schema
npx prisma db pull
```

### Step 5: Test Production Database Connection

Create a simple test to verify production database connectivity:

```javascript
// test-production-db.js
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_PRISMA_URL
      }
    }
  });

  try {
    const eventCount = await prisma.event.count();
    console.log(`✅ Production DB connected. Events: ${eventCount}`);
    
    const userCount = await prisma.user.count();
    console.log(`✅ Users: ${userCount}`);
    
  } catch (error) {
    console.error('❌ Production DB connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
```

### Step 6: Optimize Serverless Functions

The new consolidated services might be too large for Vercel's serverless functions. Consider:

1. **Increase memory allocation** (already done in vercel.json)
2. **Split large services** if they exceed limits
3. **Add timeout handling** for long-running operations

### Step 7: Deploy and Monitor

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Fix production deployment issues"
   git push
   ```

2. **Monitor Vercel deployment**:
   - Check build logs for Prisma generation
   - Verify migration deployment
   - Monitor function logs for errors

3. **Test production endpoints**:
   ```bash
   curl https://gencon-tracker.vercel.app/api/events
   curl https://gencon-tracker.vercel.app/api/filter-options
   ```

## 🔧 Troubleshooting Common Issues

### Issue: "Environment variable not found: POSTGRES_PRISMA_URL"
**Solution**: Ensure the environment variable is set in Vercel dashboard and matches exactly.

### Issue: "PrismaClientInitializationError"
**Solution**: 
1. Verify database URL format
2. Check if migrations were deployed
3. Ensure Prisma client was generated during build

### Issue: "Function timeout"
**Solution**: 
1. Increase `maxDuration` in vercel.json
2. Optimize database queries
3. Add pagination to large data sets

### Issue: "Module not found" errors
**Solution**:
1. Ensure all dependencies are in `dependencies` (not `devDependencies`)
2. Check import paths are correct
3. Verify TypeScript compilation

## 📊 Monitoring Production Health

After deployment, monitor these endpoints:

- **Health Check**: `GET /api/events?limit=1`
- **Authentication**: `GET /api/auth/session`
- **Database**: `GET /api/filter-options`

## 🚀 Quick Fix Commands

Run this diagnostic script to check your setup:

```bash
node scripts/fix-production-deployment.js
```

## 📝 Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Database migrations deployed to production
- [ ] Prisma client generated successfully
- [ ] Build process completes without errors
- [ ] API endpoints respond correctly
- [ ] Authentication flow works
- [ ] Events page loads without errors

## 🆘 Emergency Rollback

If issues persist, you can rollback to a previous working deployment:

1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click "Promote to Production"

## 📞 Support

If issues continue:
1. Check Vercel function logs for specific errors
2. Test individual API endpoints
3. Verify database connectivity
4. Review build logs for compilation errors

---

**Status**: Ready for production deployment fix
**Last Updated**: July 9, 2025
**Next Action**: Apply fixes and redeploy to Vercel
