import { NextApiRequest, NextApiResponse } from 'next';
import { DesiredEventsService } from '@/lib/services/server/desiredEventsService';
import { recalculateAndSaveTicketAssignments } from '@/utils/ticketAssignmentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { userId, canceled } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Handle canceled events query
      if (canceled === 'true') {
        const events = await DesiredEventsService.getUserCanceledEvents(userId);
        return res.status(200).json({ events });
      }

      // Get desired events based on canceled filter
      const includeCanceled = canceled === 'false' ? false : undefined;
      const desiredEvents = await DesiredEventsService.getUserDesiredEvents(userId, includeCanceled);

      // Transform to maintain API compatibility
      const userEvents = desiredEvents.map(de => ({
        id: de.id,
        userId: de.userId,
        eventId: de.eventsListId,
        event: de.eventsList
      }));

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

      // Add desired event using service
      const result = await DesiredEventsService.addDesiredEvent(userId, eventId);

      // Trigger ticket assignment recalculation in the background
      recalculateAndSaveTicketAssignments().catch(error => {
        console.error('Error recalculating ticket assignments after event creation:', error);
      });

      // Transform response to maintain API compatibility
      const userEvent = {
        id: result.desiredEvent.id,
        userId: result.desiredEvent.userId,
        eventId: result.desiredEvent.eventsListId,
        event: result.desiredEvent.eventsList
      };

      return res.status(201).json({ 
        userEvent, 
        conflicts: result.conflicts,
        capacityWarning: result.capacityWarning
      });
    } catch (error) {
      console.error('Error creating user event:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message === 'User is already registered for this event') {
          return res.status(400).json({ error: error.message });
        }
        if (error.message === 'Event not found') {
          return res.status(404).json({ error: error.message });
        }
      }
      
      return res.status(500).json({ error: 'Failed to create user event' });
    }
  }


  if (req.method === 'DELETE') {
    try {
      const { userId, eventId } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      // Remove desired event using service
      await DesiredEventsService.removeDesiredEvent(userId, eventId);

      // Trigger ticket assignment recalculation in the background
      recalculateAndSaveTicketAssignments().catch(error => {
        console.error('Error recalculating ticket assignments after event deletion:', error);
      });

      return res.status(200).json({ message: 'User event deleted successfully' });
    } catch (error) {
      console.error('Error deleting user event:', error);
      
      // Handle specific error cases
      if (error instanceof Error && error.message === 'User event not found') {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Failed to delete user event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
