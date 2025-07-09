import { NextApiRequest, NextApiResponse } from 'next';
import { EventService } from '@/lib/services/server/eventService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await EventService.getEventById(id);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      return res.status(200).json({ event });
    } catch (error) {
      console.error('Error fetching event by ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
