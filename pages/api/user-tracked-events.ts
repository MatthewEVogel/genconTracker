import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // Get user's tracked events
      const user = await prisma.userList.findUnique({
        where: { id: session.user.id },
        include: {
          trackedEvents: {
            orderBy: {
              startDateTime: 'asc'
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Transform to match expected format
      const trackedEvents = user.trackedEvents.map(event => ({
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        eventType: event.eventType,
        location: event.location,
        cost: event.cost,
        ticketsAvailable: event.ticketsAvailable,
        isCanceled: event.isCanceled
      }));

      return res.status(200).json({ trackedEvents });
    } catch (error) {
      console.error('Error fetching tracked events:', error);
      return res.status(500).json({ error: 'Failed to fetch tracked events' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}