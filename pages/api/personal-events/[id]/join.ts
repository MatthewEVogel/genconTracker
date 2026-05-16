import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ConflictDetectionService } from '@/lib/services/server/conflictDetectionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  if (req.method === 'POST') {
    try {
      const { userId, force } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get the event
      const event = await prisma.personalEvent.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              genConName: true
            }
          }
        }
      });

      if (!event) {
        return res.status(404).json({ error: 'Personal event not found' });
      }

      // Check if user is already an attendee
      if (event.attendees.includes(userId)) {
        return res.status(400).json({ error: 'User is already attending this event' });
      }

      // Only check for conflicts if force flag is not set
      if (!force) {
        const conflictResult = await ConflictDetectionService.checkConflicts({
          userId,
          startTime: event.startTime,
          endTime: event.endTime
        });

        if (conflictResult.hasConflicts) {
          const user = await prisma.userList.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, genConName: true }
          });

          // Transform conflicts to match the existing API format
          const personalEventConflicts = conflictResult.conflicts
            .filter(c => c.type === 'personal')
            .map(c => ({
              id: c.id,
              title: c.title,
              startTime: c.startTime,
              endTime: c.endTime
            }));

          const genconConflicts = conflictResult.conflicts
            .filter(c => c.type !== 'personal')
            .map(c => ({
              id: c.id,
              title: c.title,
              startDateTime: c.startTime,
              endDateTime: c.endTime
            }));

          const conflicts = [{
            userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
            personalEventConflicts,
            genconConflicts
          }];

          return res.status(409).json({ conflicts });
        }
      }

      // Add user to attendees
      const updatedEvent = await prisma.personalEvent.update({
        where: { id },
        data: {
          attendees: [...event.attendees, userId]
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              genConName: true
            }
          }
        }
      });

      return res.status(200).json({ personalEvent: updatedEvent });
    } catch (error) {
      console.error('Error joining personal event:', error);
      return res.status(500).json({ error: 'Failed to join personal event' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get the event
      const event = await prisma.personalEvent.findUnique({
        where: { id }
      });

      if (!event) {
        return res.status(404).json({ error: 'Personal event not found' });
      }

      // Check if user is an attendee
      if (!event.attendees.includes(userId)) {
        return res.status(400).json({ error: 'User is not attending this event' });
      }

      // Don't allow creator to leave (they would need to delete the event instead)
      if (event.createdBy === userId) {
        return res.status(400).json({ error: 'Event creator cannot leave the event. Delete the event instead.' });
      }

      // Remove user from attendees
      const updatedEvent = await prisma.personalEvent.update({
        where: { id },
        data: {
          attendees: event.attendees.filter(id => id !== userId)
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              genConName: true
            }
          }
        }
      });

      return res.status(200).json({ personalEvent: updatedEvent });
    } catch (error) {
      console.error('Error leaving personal event:', error);
      return res.status(500).json({ error: 'Failed to leave personal event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
