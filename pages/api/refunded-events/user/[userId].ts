import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { RefundedEventsService } from '@/lib/services/server/refundedEventsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Valid user ID is required' });
    }

    if (req.method === 'GET') {
      // Get refunded events by user ID
      const includeDetails = req.query.includeDetails === 'true';
      const data = await RefundedEventsService.getRefundedEventsByUserId(userId, includeDetails);
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunded-events/user/[userId] API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}