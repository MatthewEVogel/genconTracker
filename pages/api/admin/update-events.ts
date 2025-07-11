import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateEventsFromGenCon, UpdateResult } from '@/utils/eventUpdateService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication and admin status
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user from database to check admin status
    const user = await prisma.userList.findUnique({
      where: { email: session.user.email },
      select: { id: true, isAdmin: true, firstName: true, lastName: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log(`Admin ${user.firstName} ${user.lastName} (${user.id}) initiated event update`);

    // Perform the event update
    const result: UpdateResult = await updateEventsFromGenCon();

    // Log the result
    if (result.success) {
      console.log(`Event update completed successfully by admin ${user.id}:`, result.stats);
    } else {
      console.error(`Event update failed for admin ${user.id}:`, result.message);
    }

    // Return the result
    return res.status(result.success ? 200 : 500).json(result);

  } catch (error) {
    console.error('Error in update-events API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return res.status(500).json({
      success: false,
      message: `Server error: ${errorMessage}`,
      stats: {
        downloaded: false,
        totalEvents: 0,
        newEvents: 0,
        updatedEvents: 0,
        canceledEvents: 0,
        deletedEvents: 0,
        errors: [errorMessage]
      }
    });
  }
}
