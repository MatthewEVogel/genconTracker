import { NextApiRequest, NextApiResponse } from 'next';
import { RefundedEventsService } from '@/lib/services/server/refundedEventsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'GET') {
      // Get all refunded events
      const includeDetails = req.query.includeDetails === 'true';
      const data = await RefundedEventsService.getAllRefundedEvents(includeDetails);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Create a new refunded event record
      const { userName, ticketId } = req.body;

      if (!userName || !ticketId) {
        return res.status(400).json({ error: 'User name and Ticket ID are required' });
      }

      const data = await RefundedEventsService.createRefundedEvent({
        userName,
        ticketId
      });

      return res.status(201).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunded-events API:', error);
    
    // Handle specific error cases
    if (error.message === 'This ticket has already been marked as refunded for this user') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'User not found' || error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}