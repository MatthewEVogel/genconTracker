import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ConflictDetectionService } from '@/lib/services/server/conflictDetectionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { startTime, endTime, attendees, excludeEventId } = req.body;

    if (!startTime || !endTime || !attendees || !Array.isArray(attendees)) {
      return res.status(400).json({ error: 'Start time, end time, and attendees are required' });
    }

    // Validate that start time is before end time
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    // Check for conflicts for all attendees using the unified conflict detection service
    const conflicts = [];

    for (const userId of attendees) {
      // Use the unified conflict detection service
      const conflictResult = await ConflictDetectionService.checkConflicts({
        userId,
        startTime: start,
        endTime: end,
        excludeEventId,
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

        conflicts.push({
          userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
          personalEventConflicts,
          genconConflicts
        });
      }
    }

    return res.status(200).json({ conflicts });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return res.status(500).json({ error: 'Failed to check conflicts' });
  }
}
