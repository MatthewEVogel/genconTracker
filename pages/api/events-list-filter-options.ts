import { NextApiRequest, NextApiResponse } from 'next';
import { EventsListService } from '@/lib/services/server/eventsListService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const filterOptions = await EventsListService.getFilterOptions();
      return res.status(200).json(filterOptions);
    } catch (error) {
      console.error('Error fetching filter options:', error);
      return res.status(500).json({ error: 'Failed to fetch filter options' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}