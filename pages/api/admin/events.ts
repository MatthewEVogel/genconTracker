import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEventUpdateNotifications } from '@/utils/notificationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const user = await prisma.userList.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.method === 'GET') {
      const { search, page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      let whereClause: any = {};
      
      if (search && typeof search === 'string') {
        whereClause = {
          OR: [
            { id: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { shortDescription: { contains: search, mode: 'insensitive' } },
            { eventType: { contains: search, mode: 'insensitive' } },
            { gameSystem: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const [events, totalCount] = await Promise.all([
        prisma.eventsList.findMany({
          where: whereClause,
          orderBy: [
            { isCanceled: 'asc' },
            { startDateTime: 'asc' },
            { title: 'asc' }
          ],
          skip,
          take: limitNum,
          include: {
            _count: {
              select: {
                desiredEvents: true,
                trackedBy: true,
              }
            }
          }
        }),
        prisma.eventsList.count({ where: whereClause })
      ]);

      return res.status(200).json({
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        }
      });
    }

    if (req.method === 'PUT') {
      const { eventId, updates } = req.body;

      if (!eventId || !updates) {
        return res.status(400).json({ error: 'Event ID and updates are required' });
      }

      // Validate that the event exists
      const existingEvent = await prisma.eventsList.findUnique({
        where: { id: eventId }
      });

      if (!existingEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Validate update fields
      const allowedFields = [
        'title',
        'shortDescription',
        'eventType',
        'gameSystem',
        'startDateTime',
        'endDateTime',
        'ageRequired',
        'experienceRequired',
        'materialsRequired',
        'cost',
        'location',
        'ticketsAvailable',
        'priority',
        'isCanceled'
      ];

      const validUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          // Handle special cases
          if (key === 'ticketsAvailable' || key === 'priority') {
            validUpdates[key] = value === '' || value === null ? null : parseInt(value as string);
          } else if (key === 'isCanceled') {
            validUpdates[key] = Boolean(value);
          } else {
            validUpdates[key] = value === '' ? null : value;
          }
        }
      }

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Detect what changed for notifications
      const changes = [];
      for (const [key, newValue] of Object.entries(validUpdates)) {
        const existingValue = existingEvent[key as keyof typeof existingEvent];
        if (existingValue !== newValue) {
          switch (key) {
            case 'title':
              changes.push('title');
              break;
            case 'shortDescription':
              changes.push('description');
              break;
            case 'eventType':
              changes.push('type');
              break;
            case 'gameSystem':
              changes.push('game system');
              break;
            case 'startDateTime':
              changes.push('start time');
              break;
            case 'endDateTime':
              changes.push('end time');
              break;
            case 'ageRequired':
              changes.push('age requirement');
              break;
            case 'experienceRequired':
              changes.push('experience requirement');
              break;
            case 'materialsRequired':
              changes.push('materials required');
              break;
            case 'cost':
              changes.push('cost');
              break;
            case 'location':
              changes.push('location');
              break;
            case 'ticketsAvailable':
              changes.push('ticket availability');
              break;
            case 'priority':
              changes.push('priority');
              break;
            case 'isCanceled':
              changes.push(newValue ? 'canceled' : 'uncanceled');
              break;
          }
        }
      }

      const updatedEvent = await prisma.eventsList.update({
        where: { id: eventId },
        data: validUpdates,
        include: {
          _count: {
            select: {
              desiredEvents: true,
              trackedBy: true,
            }
          }
        }
      });

      // Send notifications to users tracking this event if there were changes
      if (changes.length > 0) {
        try {
          await sendEventUpdateNotifications(eventId, updatedEvent.title, changes);
          console.log(`Sent notifications for admin update to event ${eventId}: ${changes.join(', ')}`);
        } catch (error) {
          console.error(`Failed to send notifications for event ${eventId}:`, error);
          // Don't fail the request if notifications fail
        }
      }

      return res.status(200).json({
        message: 'Event updated successfully',
        event: updatedEvent
      });
    }

    if (req.method === 'DELETE') {
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      // Check if event exists
      const existingEvent = await prisma.eventsList.findUnique({
        where: { id: eventId },
        include: {
          _count: {
            select: {
              desiredEvents: true,
              trackedBy: true,
            }
          }
        }
      });

      if (!existingEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Delete the event (cascade will handle related records)
      await prisma.eventsList.delete({
        where: { id: eventId }
      });

      return res.status(200).json({
        message: 'Event deleted successfully',
        deletedEvent: {
          id: existingEvent.id,
          title: existingEvent.title,
          desiredEventsCount: existingEvent._count.desiredEvents,
          trackedByCount: existingEvent._count.trackedBy,
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin events API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
