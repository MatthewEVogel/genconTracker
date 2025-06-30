import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get all users with their events
      const users = await prisma.user.findMany({
        include: {
          userEvents: {
            include: {
              event: true
            }
          }
        }
      });

      // Transform the data for easier frontend consumption
      const scheduleData = users.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        events: user.userEvents.map(userEvent => ({
          id: userEvent.event.id,
          title: userEvent.event.title,
          startDateTime: userEvent.event.startDateTime,
          endDateTime: userEvent.event.endDateTime,
          eventType: userEvent.event.eventType,
          location: userEvent.event.location,
          cost: userEvent.event.cost,
          ticketsAvailable: userEvent.event.ticketsAvailable
        }))
      }));

      return res.status(200).json({ scheduleData });
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      return res.status(500).json({ error: 'Failed to fetch schedule data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
