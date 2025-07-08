import { NextApiRequest, NextApiResponse } from 'next';
import { getEventsForDisplay } from '@/lib/handlers/eventHandlers';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const day = req.query.day as string;
      const search = req.query.search as string;
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;
      const ageRatings = req.query.ageRatings as string;
      const eventTypes = req.query.eventTypes as string;
      const maxParticipants = req.query.maxParticipants as string;
      
      const filters = {
        page,
        limit,
        day,
        search,
        startTime,
        endTime,
        ageRatings: ageRatings ? ageRatings.split(',').map(rating => rating.trim()) : undefined,
        eventTypes: eventTypes ? eventTypes.split(',').map(type => type.trim()) : undefined,
        maxParticipants: maxParticipants ? parseInt(maxParticipants.trim()) : undefined
      };

      const result = await getEventsForDisplay(filters);
      
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
