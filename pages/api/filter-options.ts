import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Get all unique age ratings and event types
      const events = await prisma.event.findMany({
        select: {
          ageRequired: true,
          eventType: true,
        }
      });

      // Extract unique age ratings
      const ageRatingsSet = new Set<string>();
      const eventTypesSet = new Set<string>();

      events.forEach(event => {
        if (event.ageRequired && event.ageRequired.trim()) {
          ageRatingsSet.add(event.ageRequired.trim());
        }
        if (event.eventType && event.eventType.trim()) {
          eventTypesSet.add(event.eventType.trim());
        }
      });

      // Convert to sorted arrays
      const ageRatings = Array.from(ageRatingsSet).sort();
      const eventTypes = Array.from(eventTypesSet).sort();

      res.status(200).json({ 
        ageRatings,
        eventTypes
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
