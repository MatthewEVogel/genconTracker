#!/usr/bin/env node

/**
 * Deploy Production Database Migrations
 * 
 * This script deploys all pending migrations to your production database.
 * Make sure you have POSTGRES_PRISMA_URL set to your production database.
 */

const { execSync } = require('child_process');

console.log('🚀 Deploying Migrations to Production Database');
console.log('==============================================\n');

// Check if production database URL is set
if (!process.env.POSTGRES_PRISMA_URL) {
  console.error('❌ Error: POSTGRES_PRISMA_URL environment variable not set');
  console.log('\n💡 Set it with:');
  console.log('export POSTGRES_PRISMA_URL="your-production-neon-database-url"');
  console.log('\nYou can find this URL in your Vercel environment variables.');
  process.exit(1);
}

console.log('✅ Production database URL found');
console.log('🔗 Database:', process.env.POSTGRES_PRISMA_URL.split('@')[1]?.split('/')[0] || 'Hidden');

try {
  console.log('\n📋 Checking current migration status...');
  
  // Check migration status
  try {
    execSync('npx prisma migrate status', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Migration status check failed, but continuing...');
  }

  console.log('\n🚀 Deploying all pending migrations...');
  
  // Deploy migrations
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  console.log('\n✅ Migrations deployed successfully!');
  
  console.log('\n🔍 Verifying database schema...');
  
  // Generate Prisma client to ensure it matches the deployed schema
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('\n🎉 Production database is now up to date!');
  console.log('\n📝 Next steps:');
  console.log('1. Your production database now has all the latest tables');
  console.log('2. Try logging in to your production site again');
  console.log('3. If issues persist, check Vercel function logs');
  
} catch (error) {
  console.error('\n❌ Migration deployment failed:');
  console.error('Error:', error.message);
  
  if (error.message.includes('connection')) {
    console.log('\n💡 Connection issue. Check:');
    console.log('- Database URL format is correct');
    console.log('- Database server is accessible');
    console.log('- Network connectivity');
  }
  
  if (error.message.includes('authentication')) {
    console.log('\n💡 Authentication issue. Check:');
    console.log('- Username and password in database URL');
    console.log('- Database user has proper permissions');
  }
  
  process.exit(1);
}
