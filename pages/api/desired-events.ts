import { NextApiRequest, NextApiResponse } from 'next';
import { addEventToDesiredList, removeEventFromDesiredList, getUserDesiredEvents } from '@/lib/handlers/eventHandlers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const desiredEventIds = await getUserDesiredEvents(userId);
      
      return res.status(200).json({ desiredEventIds });
    } catch (error) {
      console.error('Error fetching desired events:', error);
      return res.status(500).json({ error: 'Failed to fetch desired events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { userId, eventId, priority } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      const result = await addEventToDesiredList(userId, eventId, priority || 1);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(201).json({ 
        message: 'Event added to desired list successfully',
        conflicts: result.conflicts,
        capacityWarning: result.capacityWarning
      });
    } catch (error) {
      console.error('Error adding event to desired list:', error);
      return res.status(500).json({ error: 'Failed to add event to desired list' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { userId, eventId } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({ error: 'User ID and Event ID are required' });
      }

      const result = await removeEventFromDesiredList(userId, eventId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({ message: 'Event removed from desired list successfully' });
    } catch (error) {
      console.error('Error removing event from desired list:', error);
      return res.status(500).json({ error: 'Failed to remove event from desired list' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}