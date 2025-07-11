import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database and verify admin status
    const user = await prisma.userList.findUnique({
      where: { email: session.user.email }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Count tickets before deletion
    const ticketCount = await prisma.purchasedEvents.count();

    // Delete all purchased events
    await prisma.purchasedEvents.deleteMany({});

    res.status(200).json({
      message: `Successfully deleted ${ticketCount} tickets`,
      deletedCount: ticketCount
    });

  } catch (error: any) {
    console.error('Error clearing tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
