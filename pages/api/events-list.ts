import { NextApiRequest, NextApiResponse } from 'next';
import { EventsListService, EventsListFilters } from '@/lib/services/server/eventsListService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const session = await getServerSession(req, res, authOptions);
      
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
      
      // Add tracking information if user is authenticated
      if (session && session.user) {
        const userTrackedEvents = await prisma.userList.findUnique({
          where: { id: session.user.id },
          select: {
            trackedEvents: {
              select: { id: true }
            }
          }
        });
        
        const trackedEventIds = new Set(userTrackedEvents?.trackedEvents.map(e => e.id) || []);
        
        // Add isTracked field to each event
        result.events = result.events.map(event => ({
          ...event,
          isTracked: trackedEventIds.has(event.id)
        }));
      }
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching events list:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}