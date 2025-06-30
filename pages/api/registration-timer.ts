import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Get the most recent registration timer
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

      // Validate required fields
      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Verify user is admin
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate date format
      const parsedDate = new Date(registrationDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Create new registration timer
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

      // Validate required fields
      if (!id) {
        return res.status(400).json({ error: 'Timer ID is required' });
      }
      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Verify user is admin
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate date format
      const parsedDate = new Date(registrationDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Update registration timer
      const timer = await prisma.registrationTimer.update({
        where: { id },
        data: {
          registrationDate: parsedDate,
          createdBy: userId
        }
      });

      res.status(200).json({ timer });
    } catch (error: any) {
      console.error('Error updating registration timer:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Timer not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id, userId } = req.body;

      // Validate required fields
      if (!id) {
        return res.status(400).json({ error: 'Timer ID is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Verify user is admin
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Delete registration timer
      await prisma.registrationTimer.delete({
        where: { id }
      });

      res.status(200).json({ message: 'Timer deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting registration timer:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Timer not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
