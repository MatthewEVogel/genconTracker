import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { eventId } = req.query;

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // GET - Fetch event details by ID
  if (req.method === 'GET') {
    try {
      const event = await prisma.eventsList.findUnique({
        where: { id: eventId },
        include: {
          _count: {
            select: {
              desiredEvents: true,
              trackedBy: true
            }
          }
        }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      return res.status(200).json({ event });

    } catch (error) {
      console.error('Error fetching event details:', error);
      return res.status(500).json({ error: 'Failed to fetch event details' });
    }
  }

  // PATCH - Update event priority (accessible to all authenticated users)
  if (req.method === 'PATCH') {
    try {
      const { priority } = req.body;

      // Validate priority value
      if (priority === undefined || ![1, 2, 3].includes(priority)) {
        return res.status(400).json({ 
          error: 'Invalid priority value. Must be 1 (Normal), 2 (Important), or 3 (Critical)' 
        });
      }

      // Check if event exists
      const event = await prisma.eventsList.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Update the event priority
      const updatedEvent = await prisma.eventsList.update({
        where: { id: eventId },
        data: { priority },
        include: {
          _count: {
            select: {
              desiredEvents: true,
              trackedBy: true
            }
          }
        }
      });

      return res.status(200).json({ 
        event: updatedEvent,
        message: 'Event priority updated successfully'
      });

    } catch (error) {
      console.error('Error updating event priority:', error);
      return res.status(500).json({ error: 'Failed to update event priority' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
