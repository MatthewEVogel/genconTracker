import { NextApiRequest, NextApiResponse } from 'next';
import { EventsListService } from '@/lib/services/server/eventsListService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { eventId } = req.query;

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await EventsListService.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      return res.status(200).json({ event });
    } catch (error) {
      console.error('Error fetching event:', error);
      return res.status(500).json({ error: 'Failed to fetch event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}