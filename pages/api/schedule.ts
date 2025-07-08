import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduleService } from '@/lib/services/scheduleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const result = await ScheduleService.getScheduleData();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      return res.status(500).json({ error: 'Failed to fetch schedule data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
