import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const timer = await prisma.registrationTimer.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ timer });
    } catch (error) {
      console.error('Error fetching registration timer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { registrationDate, userId } = req.body;

      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Manually parse datetime-local string to local Date
      let parsedDate: Date;
      if (registrationDate.includes('T') && !registrationDate.includes('Z')) {
        const [datePart, timePart] = registrationDate.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        parsedDate = new Date(year, month - 1, day, hour, minute);
      } else {
        parsedDate = new Date(registrationDate);
      }

      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const timer = await prisma.registrationTimer.create({
        data: {
          registrationDate: parsedDate,
          createdBy: userId
        }
      });

      res.status(200).json({ timer });
    } catch (error) {
      console.error('Error creating registration timer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, registrationDate, userId } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Timer ID is required' });
      }
      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Manually parse datetime-local string to local Date
      let parse
