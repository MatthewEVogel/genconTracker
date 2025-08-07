import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ConflictDetectionService } from '@/lib/services/server/conflictDetectionService';

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

      // Only check for conflicts if force flag is not set
      const { force } = req.body;

      console.log(`\n➕ CREATING PERSONAL EVENT:`);
      console.log(`   Event: "${title}" (${start.toISOString()} - ${end.toISOString()})`);
      console.log(`   Creator: ${createdBy}`);
      console.log(`   Attendees: ${attendees ? attendees.join(', ') : 'none'}`);

      if (!force) {
        const allUserIds = [createdBy, ...(attendees || [])];
        const allConflicts = [];

        for (const userId of allUserIds) {
          // Use the unified conflict detection service
          const conflictResult = await ConflictDetectionService.checkConflicts({
            userId,
            startTime: start,
            endTime: end
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

            allConflicts.push({
              userId,
              userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
              personalEventConflicts,
              genconConflicts
            });
          }
        }

        // If there are conflicts and force is not set, return conflicts without creating the event
        if (allConflicts.length > 0) {
          return res.status(409).json({ conflicts: allConflicts });
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

      return res.status(201).json({ personalEvent });
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

      // Get the existing event to use current values for fields not being updated
      const existingEvent = await prisma.personalEvent.findUnique({
        where: { id }
      });

      if (!existingEvent) {
        return res.status(404).json({ error: 'Personal event not found' });
      }

      // Use existing values if new ones aren't provided
      const finalStartTime = startTime || existingEvent.startTime.toISOString();
      const finalEndTime = endTime || existingEvent.endTime.toISOString();
      const finalAttendees = attendees !== undefined ? attendees : existingEvent.attendees;

      // Validate that start time is before end time
      const start = new Date(finalStartTime);
      const end = new Date(finalEndTime);
      
      if (start >= end) {
        return res.status(400).json({ error: 'Start time must be before end time' });
      }

      // Only check for conflicts if force flag is not set
      const { force } = req.body;

      if (!force) {
        const allUserIds = [existingEvent.createdBy, ...finalAttendees];
        const allConflicts = [];

        for (const userId of allUserIds) {
          // Use the unified conflict detection service, excluding the current event being updated
          const conflictResult = await ConflictDetectionService.checkConflicts({
            userId,
            startTime: start,
            endTime: end,
            excludeEventId: id,
            excludeEventType: 'personal'
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

            allConflicts.push({
              userId,
              userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
              personalEventConflicts,
              genconConflicts
            });
          }
        }

        // If there are conflicts and force is not set, return conflicts without updating the event
        if (allConflicts.length > 0) {
          return res.status(409).json({ conflicts: allConflicts });
        }
      }

      // Update the personal event
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
