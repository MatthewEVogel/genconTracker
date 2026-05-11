// Test script to verify DateTime sorting works correctly
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDateTimeSorting() {
  console.log('Testing DateTime sorting...\n');

  try {
    // Fetch events ordered by startDateTime
    const events = await prisma.eventsList.findMany({
      where: {
        startDateTime: {
          not: null
        }
      },
      orderBy: {
        startDateTime: 'asc'
      },
      select: {
        id: true,
        title: true,
        startDateTime: true
      },
      take: 10 // Just get first 10 for testing
    });

    console.log(`✅ Found ${events.length} events with startDateTime\n`);
    console.log('First 10 events sorted by startDateTime (ascending):\n');
    
    events.forEach((event, index) => {
      const date = event.startDateTime;
      const formatted = date ? date.toLocaleString('en-US', {
        weekday: 'short',
        month: '2-digit', 
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : 'No date';
      
      console.log(`${index + 1}. ${formatted} - ${event.title.substring(0, 50)}...`);
    });

    // Verify sorting is correct
    let isSorted = true;
    for (let i = 1; i < events.length; i++) {
      if (events[i].startDateTime && events[i-1].startDateTime) {
        if (events[i].startDateTime < events[i-1].startDateTime) {
          isSorted = false;
          console.log(`\n❌ SORTING ERROR: Event ${i} is earlier than event ${i-1}`);
          break;
        }
      }
    }

    if (isSorted) {
      console.log('\n✅ SUCCESS: Events are correctly sorted by time (including AM/PM)!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDateTimeSorting();
