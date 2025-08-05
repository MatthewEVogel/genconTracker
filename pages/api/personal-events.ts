import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check authentication for all methods
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get all personal events where the user is either the creator or an attendee
      const personalEvents = await prisma.personalEvent.findMany({
        where: {
          OR: [
            { createdBy: userId },
            { attendees: { has: userId } }
          ]
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
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      return res.status(200).json({ personalEvents });
    } catch (error) {
      console.error('Error fetching personal events:', error);
      return res.status(500).json({ error: 'Failed to fetch personal events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, startTime, endTime, location, createdBy, attendees } = req.body;

      if (!title || !startTime || !endTime || !createdBy) {
        return res.status(400).json({ error: 'Title, start time, end time, and creator are required' });
      }

      // Validate that start time is before end time
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start >= end) {
        return res.status(400).json({ error: 'Start time must be before end time' });
      }

      // Check for conflicts for the creator and all attendees
      const allUserIds = [createdBy, ...(attendees || [])];
      const conflicts = [];

      for (const userId of allUserIds) {
        // Check conflicts with existing personal events
        const personalEventConflicts = await prisma.personalEvent.findMany({
          where: {
            OR: [
              { createdBy: userId },
              { attendees: { has: userId } }
            ],
            AND: [
              { startTime: { lt: end } },
              { endTime: { gt: start } }
            ]
          },
          include: {
            creator: {
              select: {
                firstName: true,
                lastName: true,
                genConName: true
              }
            }
          }
        });

        // Check conflicts with GenCon events (purchased events)
        const genconEventConflicts = await prisma.purchasedEvents.findMany({
          where: {
            recipient: userId
          }
        });

        // Get the actual event details for GenCon events
        const eventIds = genconEventConflicts.map((pe) => pe.eventId);
        const genconEvents = await prisma.eventsList.findMany({
          where: {
            id: { in: eventIds }
          }
        });

        // Check for time conflicts with GenCon events
        const genconConflicts = genconEvents.filter(event => {
          if (!event.startDateTime || !event.endDateTime) return false;
          const eventStart = new Date(event.startDateTime);
          const eventEnd = new Date(event.endDateTime);
          return start < eventEnd && end > eventStart;
        });

        if (personalEventConflicts.length > 0 || genconConflicts.length > 0) {
          const user = await prisma.userList.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, genConName: true }
          });

          conflicts.push({
            userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
            personalEventConflicts: personalEventConflicts.map(pe => ({
              id: pe.id,
              title: pe.title,
              startTime: pe.startTime,
              endTime: pe.endTime
            })),
            genconConflicts: genconConflicts.map(ge => ({
              id: ge.id,
              title: ge.title,
              startDateTime: ge.startDateTime,
              endDateTime: ge.endDateTime
            }))
          });
        }
      }

      // Create the personal event
      const personalEvent = await prisma.personalEvent.create({
        data: {
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: location || null,
          createdBy,
          attendees: attendees || []
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

      return res.status(201).json({ 
        personalEvent,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      });
    } catch (error) {
      console.error('Error creating personal event:', error);
      return res.status(500).json({ error: 'Failed to create personal event' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, title, startTime, endTime, location, attendees } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      // Validate that start time is before end time if provided
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (start >= end) {
          return res.status(400).json({ error: 'Start time must be before end time' });
        }
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (startTime !== undefined) updateData.startTime = new Date(startTime);
      if (endTime !== undefined) updateData.endTime = new Date(endTime);
      if (location !== undefined) updateData.location = location;
      if (attendees !== undefined) updateData.attendees = attendees;

      const personalEvent = await prisma.personalEvent.update({
        where: { id },
        data: updateData,
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

      return res.status(200).json({ personalEvent });
    } catch (error) {
      console.error('Error updating personal event:', error);
      return res.status(500).json({ error: 'Failed to update personal event' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      await prisma.personalEvent.delete({
        where: { id }
      });

      return res.status(200).json({ message: 'Personal event deleted successfully' });
    } catch (error) {
      console.error('Error deleting personal event:', error);
      return res.status(500).json({ error: 'Failed to delete personal event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
