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
  const existingEvents = await prisma.eventsList.findMany({
    select: {
      id: true,
      title: true,
      shortDescription: true,
      eventType: true,
      gameSystem: true,
      startDateTime: true,
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
          desiredEvents: true,
          trackedBy: true
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
        await prisma.eventsList.create({
          data: {
            id: newEvent.id,
            title: newEvent.title,
            shortDescription: newEvent.shortDescription || null,
            eventType: newEvent.eventType || null,
            gameSystem: newEvent.gameSystem || null,
            startDateTime: newEvent.startDateTime || null,
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
          // Detect what changed for notifications
          const changes = [];
          if (existingEvent.title !== newEvent.title) changes.push('title');
          if (existingEvent.shortDescription !== (newEvent.shortDescription || null)) changes.push('description');
          if (existingEvent.eventType !== (newEvent.eventType || null)) changes.push('type');
          if (existingEvent.gameSystem !== (newEvent.gameSystem || null)) changes.push('game system');
          if (existingEvent.startDateTime !== (newEvent.startDateTime || null)) changes.push('start time');
          if (existingEvent.endDateTime !== (newEvent.endDateTime || null)) changes.push('end time');
          if (existingEvent.ageRequired !== (newEvent.ageRequired || null)) changes.push('age requirement');
          if (existingEvent.experienceRequired !== (newEvent.experienceRequired || null)) changes.push('experience requirement');
          if (existingEvent.materialsRequired !== (newEvent.materialsRequired || null)) changes.push('materials required');
          if (existingEvent.cost !== (newEvent.cost || null)) changes.push('cost');
          if (existingEvent.location !== (newEvent.location || null)) changes.push('location');
          if (existingEvent.ticketsAvailable !== (newEvent.ticketsAvailable || null)) changes.push('ticket availability');
          if (existingEvent.isCanceled) changes.push('uncanceled');

          await prisma.eventsList.update({
            where: { id: newEvent.id },
            data: {
              title: newEvent.title,
              shortDescription: newEvent.shortDescription || null,
              eventType: newEvent.eventType || null,
              gameSystem: newEvent.gameSystem || null,
              startDateTime: newEvent.startDateTime || null,
              endDateTime: newEvent.endDateTime || null,
              ageRequired: newEvent.ageRequired || null,
              experienceRequired: newEvent.experienceRequired || null,
              materialsRequired: newEvent.materialsRequired || null,
              cost: newEvent.cost || null,
              location: newEvent.location || null,
              ticketsAvailable: newEvent.ticketsAvailable || null,
              isCanceled: false // Un-cancel if it was canceled
            }
          });
          
          // Send notifications to users tracking this event
          await notifyTrackingUsers(newEvent.id, newEvent.title, changes);
          
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
        if (existingEvent._count.desiredEvents > 0 || existingEvent._count.trackedBy > 0) {
          // Event has users or is being tracked - mark as canceled
          await prisma.eventsList.update({
            where: { id: existingEvent.id },
            data: {
              isCanceled: true
            }
          });
          
          // Send notifications to users tracking this event
          await notifyTrackingUsers(existingEvent.id, existingEvent.title, ['canceled']);
          
          stats.canceledEvents++;
          console.log(`Marked event as canceled: ${existingEvent.id} - ${existingEvent.title}`);
        } else {
          // Event has no users and isn't being tracked - safe to delete
          await prisma.eventsList.delete({
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

  // Clean up canceled events that no longer have users or trackers
  try {
    const canceledEventsWithoutUsers = await prisma.eventsList.findMany({
      where: {
        isCanceled: true,
        desiredEvents: {
          none: {}
        },
        trackedBy: {
          none: {}
        }
      }
    });

    for (const event of canceledEventsWithoutUsers) {
      await prisma.eventsList.delete({
        where: { id: event.id }
      });
      stats.deletedEvents++;
      console.log(`Cleaned up canceled event with no users or trackers: ${event.id} - ${event.title}`);
    }
  } catch (error) {
    const errorMsg = `Error cleaning up canceled events: ${error instanceof Error ? error.message : 'Unknown error'}`;
    stats.errors.push(errorMsg);
    console.error(errorMsg);
  }
}

async function notifyTrackingUsers(eventId: string, eventTitle: string, changes: string[]): Promise<void> {
  try {
    // Get all users tracking this event
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId },
      include: {
        trackedBy: {
          where: {
            OR: [
              { emailNotifications: true },
              { pushNotifications: true }
            ]
          }
        }
      }
    });

    if (!event || event.trackedBy.length === 0) {
      console.log(`No users tracking event ${eventId} with notifications enabled`);
      return;
    }

    console.log(`Sending notifications to ${event.trackedBy.length} users tracking event ${eventId}`);

    // Format the changes message
    const changeMessage = changes.length === 1 
      ? `${changes[0]} changed`
      : `${changes.slice(0, -1).join(', ')} and ${changes.slice(-1)} changed`;

    // Send notifications to each user
    for (const user of event.trackedBy) {
      try {
        if (user.emailNotifications) {
          await sendEmailNotification(user.email, eventTitle, changeMessage);
        }
        
        if (user.pushNotifications) {
          await sendSMSNotification(user.email, eventTitle, changeMessage);
        }
      } catch (error) {
        console.error(`Failed to send notification to ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error notifying tracking users for event ${eventId}:`, error);
  }
}

async function sendEmailNotification(email: string, eventTitle: string, changes: string): Promise<void> {
  // For now, just log the notification
  // In a real implementation, this would integrate with SendGrid or similar
  console.log(`[EMAIL] To: ${email}, Subject: Event Update - ${eventTitle}, Changes: ${changes}`);
  
  // TODO: Implement actual email sending with SendGrid
  // const msg = {
  //   to: email,
  //   from: 'noreply@gencontracker.com',
  //   subject: `Event Update - ${eventTitle}`,
  //   text: `The event "${eventTitle}" has been updated. Changes: ${changes}.`,
  //   html: `<p>The event "<strong>${eventTitle}</strong>" has been updated.</p><p><strong>Changes:</strong> ${changes}</p>`
  // };
  // await sgMail.send(msg);
}

async function sendSMSNotification(email: string, eventTitle: string, changes: string): Promise<void> {
  // For now, just log the notification
  // In a real implementation, this would integrate with Twilio or similar
  console.log(`[SMS] To: ${email}, Message: Event "${eventTitle}" updated: ${changes}`);
  
  // TODO: Implement actual SMS sending with Twilio
  // const message = await twilio.messages.create({
  //   body: `Event "${eventTitle}" updated: ${changes}`,
  //   from: '+1234567890',
  //   to: userPhoneNumber
  // });
}
