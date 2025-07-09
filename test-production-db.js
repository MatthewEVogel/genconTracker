const { PrismaClient } = require('@prisma/client');

async function testProductionConnection() {
  console.log('🔍 Testing Production Database Connection...');
  console.log('===========================================\n');

  if (!process.env.POSTGRES_PRISMA_URL) {
    console.error('❌ Error: POSTGRES_PRISMA_URL environment variable not set');
    console.log('💡 Set it with: export POSTGRES_PRISMA_URL="your-production-url"');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_PRISMA_URL
      }
    }
  });

  try {
    console.log('🔗 Connecting to production database...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Test event count
    const eventCount = await prisma.event.count();
    console.log(`✅ Events in database: ${eventCount}`);
    
    // Test user count
    const userCount = await prisma.user.count();
    console.log(`✅ Users in database: ${userCount}`);

    // Test a sample event query (similar to what the API does)
    const sampleEvents = await prisma.event.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        cost: true,
        startDateTime: true,
        eventType: true
      }
    });

    console.log('\n📋 Sample Events:');
    sampleEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} (${event.id})`);
      console.log(`   Type: ${event.eventType || 'N/A'}`);
      console.log(`   Cost: ${event.cost ? `$${event.cost}` : 'Free'}`);
      console.log(`   Start: ${event.startDateTime || 'TBD'}`);
      console.log('');
    });

    // Test the transformation that was causing issues
    if (sampleEvents.length > 0 && sampleEvents[0].cost) {
      try {
        const costAsNumber = sampleEvents[0].cost.toNumber();
        const costAsString = costAsNumber.toString();
        console.log('✅ Cost conversion test successful:', {
          original: sampleEvents[0].cost,
          asNumber: costAsNumber,
          asString: costAsString
        });
      } catch (error) {
        console.log('❌ Cost conversion test failed:', error.message);
      }
    }

    // Test filter options query
    const eventTypes = await prisma.event.findMany({
      select: { eventType: true },
      distinct: ['eventType'],
      take: 5
    });
    console.log(`✅ Event types query successful (${eventTypes.length} types)`);

    console.log('\n🎉 All production database tests passed!');
    
  } catch (error) {
    console.error('❌ Production database test failed:');
    console.error('Error:', error.message);
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 This looks like a DNS/connection issue. Check:');
      console.log('   - Database URL format');
      console.log('   - Network connectivity');
      console.log('   - Database server status');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 This looks like an authentication issue. Check:');
      console.log('   - Username and password in connection string');
      console.log('   - Database user permissions');
    }
    
    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 Database does not exist. Check:');
      console.log('   - Database name in connection string');
      console.log('   - Database was created in Neon dashboard');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testProductionConnection().catch(console.error);
