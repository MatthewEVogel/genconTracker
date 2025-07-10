import { NextApiRequest, NextApiResponse } from 'next';
import { EventsListService, EventsListFilters } from '@/lib/services/server/eventsListService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const {
        page,
        limit,
        day,
        search,
        startTime,
        endTime,
        ageRatings,
        eventTypes,
        maxParticipants
      } = req.query;

      const filters: EventsListFilters = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        day: day as string,
        search: search as string,
        startTime: startTime as string,
        endTime: endTime as string,
        ageRatings: ageRatings as string,
        eventTypes: eventTypes as string,
        maxParticipants: maxParticipants as string,
      };

      const result = await EventsListService.getEvents(filters);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching events list:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}