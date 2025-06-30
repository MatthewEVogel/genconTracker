import AdmZip from 'adm-zip';
import { prisma } from '@/lib/prisma';
import { parseXlsxToEvents, ParsedEventData } from './xlsxToTsv';

export interface UpdateResult {
  success: boolean;
  message: string;
  stats: {
    downloaded: boolean;
    totalEvents: number;
    newEvents: number;
    updatedEvents: number;
    canceledEvents: number;
    deletedEvents: number;
    errors: string[];
  };
}

const GENCON_EVENTS_URL = 'https://www.gencon.com/downloads/events.zip';

export async function updateEventsFromGenCon(): Promise<UpdateResult> {
  const result: UpdateResult = {
    success: false,
    message: '',
    stats: {
      downloaded: false,
      totalEvents: 0,
      newEvents: 0,
      updatedEvents: 0,
      canceledEvents: 0,
      deletedEvents: 0,
      errors: []
    }
  };

  try {
    console.log('Starting GenCon events update...');

    // Step 1: Download the ZIP file
    console.log('Downloading events.zip from GenCon...');
    const response = await fetch(GENCON_EVENTS_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to download events.zip: ${response.status} ${response.statusText}`);
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    result.stats.downloaded = true;
    console.log('Successfully downloaded events.zip');

    // Step 2: Extract and parse the XLSX file
    console.log('Extracting and parsing XLSX file...');
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    // Find the XLSX file in the ZIP
    const xlsxEntry = zipEntries.find(entry => 
      entry.entryName.toLowerCase().endsWith('.xlsx') && !entry.isDirectory
    );

    if (!xlsxEntry) {
      throw new Error('No XLSX file found in the downloaded ZIP archive');
    }

    console.log(`Found XLSX file: ${xlsxEntry.entryName}`);
    const xlsxBuffer = xlsxEntry.getData();
    
    // Parse the XLSX file
    const newEvents = parseXlsxToEvents(xlsxBuffer);
    result.stats.totalEvents = newEvents.length;
    console.log(`Parsed ${newEvents.length} events from XLSX`);

    // Step 3: Perform differential update
    console.log('Performing differential database update...');
    await performDifferentialUpdate(newEvents, result.stats);

    result.success = true;
    result.message = `Successfully updated events. New: ${result.stats.newEvents}, Updated: ${result.stats.updatedEvents}, Canceled: ${result.stats.canceledEvents}, Deleted: ${result.stats.deletedEvents}`;
    
    console.log('Event update completed successfully');
    console.log(result.message);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    result.success = false;
    result.message = `Event update failed: ${errorMessage}`;
    result.stats.errors.push(errorMessage);
    
    console.error('Event update failed:', error);
  }

  return result;
}

async function performDifferentialUpdate(
  newEvents: ParsedEventData[], 
  stats: UpdateResult['stats']
): Promise<void> {
  // Get all existing events from database
  const existingEvents = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      shortDescription: true,
      eventType: true,
      gameSystem: true,
      startDateTime: true,
      duration: true,
      endDateTime: true,
      ageRequired: true,
      experienceRequired: true,
      materialsRequired: true,
      cost: true,
      location: true,
      ticketsAvailable: true,
      isCanceled: true,
      _count: {
        select: {
          userEvents: true
        }
      }
    }
  });

  const existingEventMap = new Map(existingEvents.map(event => [event.id, event]));
  const newEventIds = new Set(newEvents.map(event => event.id));

  // Process new/updated events
  for (const newEvent of newEvents) {
    try {
      const existingEvent = existingEventMap.get(newEvent.id);

      if (!existingEvent) {
        // New event - create it
        await prisma.event.create({
          data: {
            id: newEvent.id,
            title: newEvent.title,
            shortDescription: newEvent.shortDescription || null,
            eventType: newEvent.eventType || null,
            gameSystem: newEvent.gameSystem || null,
            startDateTime: newEvent.startDateTime || null,
            duration: newEvent.duration || null,
            endDateTime: newEvent.endDateTime || null,
            ageRequired: newEvent.ageRequired || null,
            experienceRequired: newEvent.experienceRequired || null,
            materialsRequired: newEvent.materialsRequired || null,
            cost: newEvent.cost || null,
            location: newEvent.location || null,
            ticketsAvailable: newEvent.ticketsAvailable || null,
            priority: 1, // Default priority
            isCanceled: false
          }
        });
        stats.newEvents++;
        console.log(`Created new event: ${newEvent.id} - ${newEvent.title}`);

      } else {
        // Existing event - check if it needs updating
        const needsUpdate = (
          existingEvent.title !== newEvent.title ||
          existingEvent.shortDescription !== (newEvent.shortDescription || null) ||
          existingEvent.eventType !== (newEvent.eventType || null) ||
          existingEvent.gameSystem !== (newEvent.gameSystem || null) ||
          existingEvent.startDateTime !== (newEvent.startDateTime || null) ||
          existingEvent.duration !== (newEvent.duration || null) ||
          existingEvent.endDateTime !== (newEvent.endDateTime || null) ||
          existingEvent.ageRequired !== (newEvent.ageRequired || null) ||
          existingEvent.experienceRequired !== (newEvent.experienceRequired || null) ||
          existingEvent.materialsRequired !== (newEvent.materialsRequired || null) ||
          existingEvent.cost !== (newEvent.cost || null) ||
          existingEvent.location !== (newEvent.location || null) ||
          existingEvent.ticketsAvailable !== (newEvent.ticketsAvailable || null) ||
          existingEvent.isCanceled // If it was canceled, un-cancel it
        );

        if (needsUpdate) {
          await prisma.event.update({
            where: { id: newEvent.id },
            data: {
              title: newEvent.title,
              shortDescription: newEvent.shortDescription || null,
              eventType: newEvent.eventType || null,
              gameSystem: newEvent.gameSystem || null,
              startDateTime: newEvent.startDateTime || null,
              duration: newEvent.duration || null,
              endDateTime: newEvent.endDateTime || null,
              ageRequired: newEvent.ageRequired || null,
              experienceRequired: newEvent.experienceRequired || null,
              materialsRequired: newEvent.materialsRequired || null,
              cost: newEvent.cost || null,
              location: newEvent.location || null,
              ticketsAvailable: newEvent.ticketsAvailable || null,
              isCanceled: false, // Un-cancel if it was canceled
              canceledAt: null,
              lastUpdated: new Date()
            }
          });
          stats.updatedEvents++;
          console.log(`Updated event: ${newEvent.id} - ${newEvent.title}`);
        }
      }
    } catch (error) {
      const errorMsg = `Error processing event ${newEvent.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      stats.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Process canceled events (events that exist in DB but not in new data)
  for (const existingEvent of existingEvents) {
    if (!newEventIds.has(existingEvent.id) && !existingEvent.isCanceled) {
      try {
        if (existingEvent._count.userEvents > 0) {
          // Event has users - mark as canceled
          await prisma.event.update({
            where: { id: existingEvent.id },
            data: {
              isCanceled: true,
              canceledAt: new Date(),
              lastUpdated: new Date()
            }
          });
          stats.canceledEvents++;
          console.log(`Marked event as canceled: ${existingEvent.id} - ${existingEvent.title}`);
        } else {
          // Event has no users - safe to delete
          await prisma.event.delete({
            where: { id: existingEvent.id }
          });
          stats.deletedEvents++;
          console.log(`Deleted unused event: ${existingEvent.id} - ${existingEvent.title}`);
        }
      } catch (error) {
        const errorMsg = `Error handling canceled event ${existingEvent.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  // Clean up canceled events that no longer have users
  try {
    const canceledEventsWithoutUsers = await prisma.event.findMany({
      where: {
        isCanceled: true,
        userEvents: {
          none: {}
        }
      }
    });

    for (const event of canceledEventsWithoutUsers) {
      await prisma.event.delete({
        where: { id: event.id }
      });
      stats.deletedEvents++;
      console.log(`Cleaned up canceled event with no users: ${event.id} - ${event.title}`);
    }
  } catch (error) {
    const errorMsg = `Error cleaning up canceled events: ${error instanceof Error ? error.message : 'Unknown error'}`;
    stats.errors.push(errorMsg);
    console.error(errorMsg);
  }
}
