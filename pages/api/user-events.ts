import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get user's desired events
      const userEvents = await prisma.desiredEvents.findMany({
        where: { userId },
        include: {
          eventsList: true
        },
        orderBy: {
          eventsList: {
            startDateTime: 'asc'
          }
        }
      });

      // Transform to match expected format
      const transformedEvents = userEvents.map(de => ({
        event: {
          id: de.eventsList.id,
          title: de.eventsList.title,
          startDateTime: de.eventsList.startDateTime,
          endDateTime: de.eventsList.endDateTime,
          eventType: de.eventsList.eventType,
          location: de.eventsList.location,
          cost: de.eventsList.cost,
          ticketsAvailable: de.eventsList.ticketsAvailable
        }
      }));

      return res.status(200).json({ userEvents: transformedEvents });
    } catch (error) {
      console.error('Error fetching user events:', error);
      return res.status(500).json({ error: 'Failed to fetch user events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { userId, eventId } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      // Check if user exists
      const user = await prisma.userList.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if event exists
      const event = await prisma.eventsList.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if user already has this event
      const existingDesiredEvent = await prisma.desiredEvents.findUnique({
        where: {
          userId_eventsListId: {
            userId,
            eventsListId: eventId
          }
        }
      });

      if (existingDesiredEvent) {
        return res.status(400).json({ error: 'User already has this event in their schedule' });
      }

      // Check for time conflicts
      const userEvents = await prisma.desiredEvents.findMany({
        where: { userId },
        include: { eventsList: true }
      });

      const conflicts = [];
      let capacityWarning = false;

      if (event.startDateTime && event.endDateTime) {
        const newEventStart = new Date(event.startDateTime);
        const newEventEnd = new Date(event.endDateTime);

        for (const userEvent of userEvents) {
          const existingEvent = userEvent.eventsList;
          if (existingEvent.startDateTime && existingEvent.endDateTime) {
            const existingStart = new Date(existingEvent.startDateTime);
            const existingEnd = new Date(existingEvent.endDateTime);

            // Check for time overlap
            if (newEventStart < existingEnd && newEventEnd > existingStart) {
              conflicts.push({
                id: existingEvent.id,
                title: existingEvent.title,
                startDateTime: existingEvent.startDateTime,
                endDateTime: existingEvent.endDateTime
              });
            }
          }
        }
      }

      // Check capacity
      if (event.ticketsAvailable !== null) {
        const currentAssignments = await prisma.desiredEvents.count({
          where: { eventsListId: eventId }
        });
        
        if (currentAssignments >= event.ticketsAvailable) {
          capacityWarning = true;
        }
      }

      // Add the event to user's desired events
      await prisma.desiredEvents.create({
        data: {
          userId,
          eventsListId: eventId
        }
      });

      const response: any = {
        message: 'Event added to schedule successfully'
      };

      if (conflicts.length > 0) {
        response.conflicts = conflicts;
      }

      if (capacityWarning) {
        response.capacityWarning = true;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error adding user event:', error);
      return res.status(500).json({ error: 'Failed to add event to schedule' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { userId, eventId } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      // Remove the event from user's desired events
      const deletedEvent = await prisma.desiredEvents.deleteMany({
        where: {
          userId,
          eventsListId: eventId
        }
      });

      if (deletedEvent.count === 0) {
        return res.status(404).json({ error: 'Event not found in user schedule' });
      }

      return res.status(200).json({ message: 'Event removed from schedule successfully' });
    } catch (error) {
      console.error('Error removing user event:', error);
      return res.status(500).json({ error: 'Failed to remove event from schedule' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}