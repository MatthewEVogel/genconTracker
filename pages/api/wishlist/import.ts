import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { parseGenConWishlist, validateWishlistEvents } from '@/utils/wishlistParser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, wishlistText } = req.body;

    if (!userId || !wishlistText) {
      return res.status(400).json({ error: 'Missing required fields: userId and wishlistText' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse the wishlist text
    const parsedEvents = parseGenConWishlist(wishlistText);
    const { validEvents, invalidEvents } = validateWishlistEvents(parsedEvents);

    if (validEvents.length === 0) {
      return res.status(400).json({ 
        error: 'No valid event IDs found in the wishlist text',
        invalidEvents: invalidEvents.map(e => e.eventId)
      });
    }

    // Check which events exist in the database
    const eventIds = validEvents.map(e => e.eventId);
    const existingEvents = await prisma.event.findMany({
      where: {
        id: { in: eventIds }
      },
      select: {
        id: true,
        title: true,
        isCanceled: true
      }
    });

    const existingEventIds = new Set(existingEvents.map(e => e.id));
    const foundEvents = validEvents.filter(e => existingEventIds.has(e.eventId));
    const notFoundEvents = validEvents.filter(e => !existingEventIds.has(e.eventId));

    // Check which events the user is already registered for
    const existingUserEvents = await prisma.userEvent.findMany({
      where: {
        userId,
        eventId: { in: foundEvents.map(e => e.eventId) }
      },
      select: {
        eventId: true
      }
    });

    const alreadyRegisteredIds = new Set(existingUserEvents.map(ue => ue.eventId));
    const eventsToAdd = foundEvents.filter(e => !alreadyRegisteredIds.has(e.eventId));
    const alreadyRegistered = foundEvents.filter(e => alreadyRegisteredIds.has(e.eventId));

    // Filter out canceled events
    const canceledEvents = existingEvents.filter(e => e.isCanceled);
    const canceledEventIds = new Set(canceledEvents.map(e => e.id));
    const eventsToAddFiltered = eventsToAdd.filter(e => !canceledEventIds.has(e.eventId));
    const canceledEventsFromWishlist = eventsToAdd.filter(e => canceledEventIds.has(e.eventId));

    // Add events to user's schedule
    const userEventsToCreate = eventsToAddFiltered.map(event => ({
      userId,
      eventId: event.eventId
    }));

    let addedEvents: Array<{
      id: string;
      title: string;
      startDateTime: string | null;
      cost: string | null;
    }> = [];
    
    if (userEventsToCreate.length > 0) {
      await prisma.userEvent.createMany({
        data: userEventsToCreate,
        skipDuplicates: true
      });

      // Get the added events with their details
      addedEvents = await prisma.event.findMany({
        where: {
          id: { in: eventsToAddFiltered.map(e => e.eventId) }
        },
        select: {
          id: true,
          title: true,
          startDateTime: true,
          cost: true
        }
      });
    }

    // Prepare response with detailed results
    const results = {
      success: true,
      summary: {
        totalParsed: parsedEvents.length,
        validEvents: validEvents.length,
        invalidEvents: invalidEvents.length,
        foundInDatabase: foundEvents.length,
        notFoundInDatabase: notFoundEvents.length,
        alreadyRegistered: alreadyRegistered.length,
        canceledEvents: canceledEventsFromWishlist.length,
        successfullyAdded: addedEvents.length
      },
      details: {
        addedEvents: addedEvents.map(e => ({
          id: e.id,
          title: e.title,
          startDateTime: e.startDateTime,
          cost: e.cost
        })),
        alreadyRegistered: alreadyRegistered.map(e => ({
          eventId: e.eventId,
          title: e.title
        })),
        notFound: notFoundEvents.map(e => ({
          eventId: e.eventId,
          title: e.title
        })),
        canceled: canceledEventsFromWishlist.map(e => {
          const dbEvent = existingEvents.find(de => de.id === e.eventId);
          return {
            eventId: e.eventId,
            title: dbEvent?.title || e.title
          };
        }),
        invalid: invalidEvents.map(e => ({
          eventId: e.eventId,
          title: e.title
        }))
      }
    };

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error importing wishlist:', error);
    return res.status(500).json({ 
      error: 'Failed to import wishlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
