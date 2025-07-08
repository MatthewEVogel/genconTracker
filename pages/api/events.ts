import { NextApiRequest, NextApiResponse } from 'next';
import { EventService } from '@/lib/services/server/eventService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 100,
        day: req.query.day as string,
        search: req.query.search as string,
        startTime: req.query.startTime as string,
        endTime: req.query.endTime as string,
        ageRatings: req.query.ageRatings as string,
        eventTypes: req.query.eventTypes as string,
        maxParticipants: req.query.maxParticipants as string,
      };

      const result = await EventService.getEvents(filters);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
