import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { eventId } = req.query;
  
  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  if (req.method === 'POST') {
    try {
      // Check if event exists
      const event = await prisma.eventsList.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if user already tracking this event
      const existingTracking = await prisma.eventsList.findFirst({
        where: {
          id: eventId,
          trackedBy: {
            some: {
              id: session.user.id
            }
          }
        }
      });

      if (existingTracking) {
        return res.status(400).json({ error: 'User already tracking this event' });
      }

      // Add user to event's trackedBy list
      await prisma.eventsList.update({
        where: { id: eventId },
        data: {
          trackedBy: {
            connect: { id: session.user.id }
          }
        }
      });

      return res.status(200).json({ message: 'Event tracking enabled successfully' });
    } catch (error) {
      console.error('Error tracking event:', error);
      return res.status(500).json({ error: 'Failed to track event' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Remove user from event's trackedBy list
      await prisma.eventsList.update({
        where: { id: eventId },
        data: {
          trackedBy: {
            disconnect: { id: session.user.id }
          }
        }
      });

      return res.status(200).json({ message: 'Event tracking disabled successfully' });
    } catch (error) {
      console.error('Error untracking event:', error);
      return res.status(500).json({ error: 'Failed to untrack event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}