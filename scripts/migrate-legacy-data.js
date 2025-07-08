const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateLegacyData() {
  console.log('Starting legacy data migration...');
  
  try {
    // Step 1: Check current state
    console.log('\n1. Checking current data state...');
    
    const purchasedTicketsCount = await prisma.purchasedTicket.count();
    const purchasedEventsCount = await prisma.purchasedEvent.count();
    const refundedEventsCount = await prisma.refundedEvent.count();
    const usersCount = await prisma.user.count();
    
    console.log(`- Users: ${usersCount}`);
    console.log(`- Legacy purchased tickets: ${purchasedTicketsCount}`);
    console.log(`- Current purchased events: ${purchasedEventsCount}`);
    console.log(`- Current refunded events: ${refundedEventsCount}`);
    
    // Step 2: Check for tickets without matching users
    console.log('\n2. Checking for tickets without matching users...');
    
    const allTickets = await prisma.purchasedTicket.findMany({
      select: {
        id: true,
        purchaser: true,
        eventId: true,
        recipient: true,
        isRefunded: true
      }
    });
    
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });
    
    const userMap = new Map();
    allUsers.forEach(user => {
      const fullName = `${user.firstName} ${user.lastName}`;
      userMap.set(fullName, user.id);
    });
    
    const orphanedTickets = [];
    const matchedTickets = [];
    
    allTickets.forEach(ticket => {
      if (userMap.has(ticket.purchaser)) {
        matchedTickets.push({
          ...ticket,
          userId: userMap.get(ticket.purchaser)
        });
      } else {
        orphanedTickets.push(ticket);
      }
    });
    
    console.log(`- Tickets with matching users: ${matchedTickets.length}`);
    console.log(`- Orphaned tickets (no user match): ${orphanedTickets.length}`);
    
    if (orphanedTickets.length > 0) {
      console.log('Orphaned tickets by purchaser:');
      const orphanedByPurchaser = orphanedTickets.reduce((acc, ticket) => {
        acc[ticket.purchaser] = (acc[ticket.purchaser] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(orphanedByPurchaser).forEach(([purchaser, count]) => {
        console.log(`  - "${purchaser}": ${count} tickets`);
      });
    }
    
    // Step 3: Ask for confirmation before proceeding
    console.log(`\n3. Ready to migrate ${matchedTickets.length} tickets...`);
    
    if (process.argv.includes('--dry-run')) {
      console.log('DRY RUN MODE - No data will be migrated');
      return;
    }
    
    if (!process.argv.includes('--confirm')) {
      console.log('Add --confirm flag to proceed with migration, or --dry-run to test');
      return;
    }
    
    // Step 4: Migrate data in transaction
    console.log('\n4. Starting migration transaction...');
    
    await prisma.$transaction(async (tx) => {
      let migratedPurchased = 0;
      let migratedRefunded = 0;
      
      for (const ticket of matchedTickets) {
        if (!ticket.isRefunded) {
          // Migrate to purchased_events
          await tx.purchasedEvent.create({
            data: {
              id: ticket.id, // Keep same ID
              userId: ticket.userId,
              eventId: ticket.eventId,
              recipient: ticket.recipient,
              purchaseDate: new Date(), // We'll use current time since legacy doesn't have this
              cost: null, // No cost data in legacy
              confirmation: null,
            }
          });
          migratedPurchased++;
        } else {
          // Migrate to refunded_events
          await tx.refundedEvent.create({
            data: {
              userId: ticket.userId,
              eventId: ticket.eventId,
              recipient: ticket.recipient,
              originalCost: null,
              refundAmount: null,
              purchaseDate: new Date(), // Approximate
              refundDate: new Date(),
              refundReason: 'Migrated from legacy system',
              confirmation: null,
            }
          });
          migratedRefunded++;
        }
      }
      
      console.log(`- Migrated ${migratedPurchased} tickets to purchased_events`);
      console.log(`- Migrated ${migratedRefunded} tickets to refunded_events`);
    });
    
    console.log('\n5. Migration completed successfully!');
    
    // Step 5: Verify migration
    const finalPurchasedEventsCount = await prisma.purchasedEvent.count();
    const finalRefundedEventsCount = await prisma.refundedEvent.count();
    
    console.log(`- Final purchased events count: ${finalPurchasedEventsCount}`);
    console.log(`- Final refunded events count: ${finalRefundedEventsCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateLegacyData();