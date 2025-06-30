import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { recalculateAndSaveTicketAssignments } from '@/utils/ticketAssignmentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { userId, canceled } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Build where clause based on query parameters
      const whereClause: any = { userId };
      
      // If canceled=true, only return canceled events
      // If canceled=false, only return non-canceled events
      // If canceled is not specified, return all events
      if (canceled === 'true') {
        whereClause.event = { isCanceled: true };
      } else if (canceled === 'false') {
        whereClause.event = { isCanceled: false };
      }

      const userEvents = await prisma.userEvent.findMany({
        where: whereClause,
        include: {
          event: true
        }
      });

      // For canceled events query, return in the format expected by CanceledEventAlert
      if (canceled === 'true') {
        const events = userEvents.map(ue => ({
          id: ue.event.id,
          title: ue.event.title,
          startDateTime: ue.event.startDateTime,
          canceledAt: ue.event.canceledAt,
          isCanceled: ue.event.isCanceled
        }));
        return res.status(200).json({ events });
      }

      return res.status(200).json({ userEvents });
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

      // Check if user event already exists
      const existingUserEvent = await prisma.userEvent.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId
          }
        }
      });

      if (existingUserEvent) {
        return res.status(400).json({ error: 'User is already registered for this event' });
      }

      // Get event details for conflict checking
      const event = await prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check for time conflicts
      const userEvents = await prisma.userEvent.findMany({
        where: { userId },
        include: { event: true }
      });

      const conflicts = [];
      
      if (event.startDateTime && event.endDateTime) {
        const newEventStart = new Date(event.startDateTime);
        const newEventEnd = new Date(event.endDateTime);

        for (const userEvent of userEvents) {
          if (userEvent.event.startDateTime && userEvent.event.endDateTime) {
            const existingStart = new Date(userEvent.event.startDateTime);
            const existingEnd = new Date(userEvent.event.endDateTime);

            // Check for overlap
            if (newEventStart < existingEnd && newEventEnd > existingStart) {
              conflicts.push({
                eventId: userEvent.event.id,
                title: userEvent.event.title,
                startDateTime: userEvent.event.startDateTime,
                endDateTime: userEvent.event.endDateTime
              });
            }
          }
        }
      }

      // Check capacity
      const eventSignups = await prisma.userEvent.count({
        where: { eventId }
      });

      const capacityWarning = event.ticketsAvailable ? eventSignups >= event.ticketsAvailable : false;

      // Create the user event
      const userEvent = await prisma.userEvent.create({
        data: {
          userId,
          eventId
        },
        include: {
          event: true
        }
      });

      // Trigger ticket assignment recalculation in the background
      recalculateAndSaveTicketAssignments().catch(error => {
        console.error('Error recalculating ticket assignments after event creation:', error);
      });

      return res.status(201).json({ 
        userEvent, 
        conflicts,
        capacityWarning
      });
    } catch (error) {
      console.error('Error creating user event:', error);
      return res.status(500).json({ error: 'Failed to create user event' });
    }
  }


  if (req.method === 'DELETE') {
    try {
      const { userId, eventId } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      const userEvent = await prisma.userEvent.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId
          }
        }
      });

      if (!userEvent) {
        return res.status(404).json({ error: 'User event not found' });
      }

      await prisma.userEvent.delete({
        where: {
          userId_eventId: {
            userId,
            eventId
          }
        }
      });

      // Trigger ticket assignment recalculation in the background
      recalculateAndSaveTicketAssignments().catch(error => {
        console.error('Error recalculating ticket assignments after event deletion:', error);
      });

      return res.status(200).json({ message: 'User event deleted successfully' });
    } catch (error) {
      console.error('Error deleting user event:', error);
      return res.status(500).json({ error: 'Failed to delete user event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
