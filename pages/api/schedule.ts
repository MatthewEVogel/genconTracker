import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduleService } from '@/lib/services/server/scheduleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      console.log('Schedule API: Starting to fetch schedule data');
      const result = await ScheduleService.getScheduleData();
      console.log('Schedule API: Successfully fetched schedule data:', result.scheduleData?.length, 'users');
      return res.status(200).json(result);
    } catch (error) {
      console.error('Schedule API: Error fetching schedule data:', error);
      console.error('Schedule API: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return res.status(500).json({ 
        error: 'Failed to fetch schedule data',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
