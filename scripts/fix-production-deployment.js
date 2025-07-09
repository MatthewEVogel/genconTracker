#!/usr/bin/env node

/**
 * Production Deployment Fix Script
 * 
 * This script helps diagnose and fix common production deployment issues
 * for the GenCon Tracker application on Vercel.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 GenCon Tracker Production Deployment Fix');
console.log('============================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: Please run this script from the project root directory');
  process.exit(1);
}

// Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('📦 Project:', packageJson.name, 'v' + packageJson.version);

// Check if Prisma schema exists
if (!fs.existsSync('prisma/schema.prisma')) {
  console.error('❌ Error: Prisma schema not found');
  process.exit(1);
}

console.log('✅ Prisma schema found');

// Check environment variables
console.log('\n🔍 Checking Environment Variables...');
const requiredEnvVars = [
  'POSTGRES_PRISMA_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

const missingEnvVars = [];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  } else {
    console.log(`✅ ${envVar} is set`);
  }
});

if (missingEnvVars.length > 0) {
  console.log('\n⚠️  Missing Environment Variables:');
  missingEnvVars.forEach(envVar => {
    console.log(`❌ ${envVar}`);
  });
  console.log('\n📝 Make sure these are set in your Vercel dashboard:');
  console.log('   https://vercel.com/your-project/settings/environment-variables');
}

// Check Prisma client
console.log('\n🔍 Checking Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully');
} catch (error) {
  console.error('❌ Error generating Prisma client:', error.message);
}

// Check database connection (if env vars are available)
if (process.env.POSTGRES_PRISMA_URL) {
  console.log('\n🔍 Testing Database Connection...');
  try {
    execSync('npx prisma db pull --preview-feature', { stdio: 'inherit' });
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

// Check migrations
console.log('\n🔍 Checking Database Migrations...');
try {
  const migrationsDir = 'prisma/migrations';
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter(f => f !== 'migration_lock.toml');
    console.log(`✅ Found ${migrations.length} migrations`);
    migrations.forEach(migration => {
      console.log(`   - ${migration}`);
    });
  } else {
    console.log('⚠️  No migrations directory found');
  }
} catch (error) {
  console.error('❌ Error checking migrations:', error.message);
}

// Recommendations
console.log('\n💡 Production Deployment Recommendations:');
console.log('==========================================');
console.log('1. Ensure all environment variables are set in Vercel dashboard');
console.log('2. Make sure POSTGRES_PRISMA_URL points to your Neon production database');
console.log('3. Run database migrations manually if needed:');
console.log('   npx prisma migrate deploy');
console.log('4. Verify Prisma client generation in build logs');
console.log('5. Check Vercel function logs for specific error details');

console.log('\n🚀 Next Steps:');
console.log('1. Fix any missing environment variables');
console.log('2. Redeploy to Vercel');
console.log('3. Check Vercel function logs for any remaining errors');

console.log('\n✨ Script completed!');
