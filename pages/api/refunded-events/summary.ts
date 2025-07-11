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

    if (req.method === 'GET') {
      // Get refunded events summary statistics
      const summary = await RefundedEventsService.getRefundedEventsSummary();
      return res.status(200).json(summary);
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunded-events/summary API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}