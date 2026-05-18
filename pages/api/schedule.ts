import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduleService, ScheduleFilter } from '@/lib/services/server/scheduleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const filter = (req.query.filter as ScheduleFilter) || 'wishlist';
      
      // Validate filter parameter
      if (filter !== 'wishlist' && filter !== 'purchased') {
        return res.status(400).json({ error: 'Invalid filter parameter. Must be "wishlist" or "purchased"' });
      }
      
      const result = await ScheduleService.getScheduleData(filter);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      return res.status(500).json({ error: 'Failed to fetch schedule data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
