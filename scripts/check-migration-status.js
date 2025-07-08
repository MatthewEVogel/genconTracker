const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMigrationStatus() {
  try {
    console.log('Checking database migration status...');
    
    // Check if new tables exist
    console.log('\n1. Checking table existence...');
    
    try {
      const purchasedEventsCount = await prisma.purchasedEvent.count();
      console.log(`✅ purchased_events table exists (${purchasedEventsCount} records)`);
    } catch (error) {
      console.log(`❌ purchased_events table does not exist: ${error.message}`);
    }
    
    try {
      const refundedEventsCount = await prisma.refundedEvent.count();
      console.log(`✅ refunded_events table exists (${refundedEventsCount} records)`);
    } catch (error) {
      console.log(`❌ refunded_events table does not exist: ${error.message}`);
    }
    
    try {
      const desiredEventsCount = await prisma.desiredEvent.count();
      console.log(`✅ desired_events table exists (${desiredEventsCount} records)`);
    } catch (error) {
      console.log(`❌ desired_events table does not exist: ${error.message}`);
    }
    
    // Check migration status
    console.log('\n2. Checking migration status...');
    
    try {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 5
      `;
      
      console.log('Recent migrations:');
      migrations.forEach(migration => {
        console.log(`  - ${migration.migration_name} (${migration.finished_at})`);
      });
      
      const latestMigration = migrations[0];
      if (latestMigration && latestMigration.migration_name.includes('refactor_to_five_table_schema')) {
        console.log('✅ Latest migration includes 5-table schema refactor');
      } else {
        console.log('❌ 5-table schema migration not found in recent migrations');
      }
      
    } catch (error) {
      console.log(`❌ Could not check migration status: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus();