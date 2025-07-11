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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid refunded event ID is required' });
    }

    if (req.method === 'DELETE') {
      // Delete a refunded event record
      await RefundedEventsService.deleteRefundedEvent(id);
      return res.status(200).json({ message: 'Refunded event record deleted successfully' });
    }

    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunded-events/[id] API:', error);
    
    // Handle specific error cases
    if (error.message === 'Refunded event record not found') {
      return res.status(404).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}