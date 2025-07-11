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

    const { userName } = req.query;

    if (!userName || typeof userName !== 'string') {
      return res.status(400).json({ error: 'Valid user name is required' });
    }

    if (req.method === 'GET') {
      // Get refunded events by user name
      const includeDetails = req.query.includeDetails === 'true';
      const data = await RefundedEventsService.getRefundedEventsByUserName(userName, includeDetails);
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunded-events/user/[userId] API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}