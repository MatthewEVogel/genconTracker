// pages/api/registrationTimer.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Helper: parse a "YYYY-MM-DDTHH:MM" local string + offset → proper UTC Date
  function parseLocalDate(
    dateTimeLocal: string,
    tzOffsetMinutes: number
  ): Date {
    const [datePart, timePart] = dateTimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    // Build UTC epoch: local time + offset → UTC
    const utcMillis =
      Date.UTC(year, month - 1, day, hour, minute) +
      tzOffsetMinutes * 60_000;
    return new Date(utcMillis);
  }

  if (req.method === 'GET') {
    try {
      const timer = await prisma.registrationTimer.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json({ timer });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST = create
  if (req.method === 'POST') {
    try {
      const { registrationDate, userId, timezoneOffsetMinutes } = req.body;

      // Debug: Log what we received
      console.log('Server received body:', req.body);
      console.log('timezoneOffsetMinutes received:', timezoneOffsetMinutes, typeof timezoneOffsetMinutes);

      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.userList.findUnique({ where: { id: userId } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      let parsedDate: Date;
      if (
        registrationDate.includes('T') &&
        !registrationDate.toUpperCase().includes('Z')
      ) {
        if (typeof timezoneOffsetMinutes !== 'number') {
          return res
            .status(400)
            .json({ error: 'timezoneOffsetMinutes is required for datetime-local' });
        }
        parsedDate = parseLocalDate(registrationDate, timezoneOffsetMinutes);
      } else {
        // ISO string (with Z) → just parse
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

      return res.status(200).json({ timer });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT = update
  if (req.method === 'PUT') {
    try {
      const { id, registrationDate, userId, timezoneOffsetMinutes } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Timer ID is required' });
      }
      if (!registrationDate) {
        return res.status(400).json({ error: 'Registration date is required' });
      }
      if (typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.userList.findUnique({ where: { id: userId } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      let parsedDate: Date;
      if (
        registrationDate.includes('T') &&
        !registrationDate.toUpperCase().includes('Z')
      ) {
        if (typeof timezoneOffsetMinutes !== 'number') {
          return res
            .status(400)
            .json({ error: 'timezoneOffsetMinutes is required for datetime-local' });
        }
        parsedDate = parseLocalDate(registrationDate, timezoneOffsetMinutes);
      } else {
        parsedDate = new Date(registrationDate);
      }

      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const timer = await prisma.registrationTimer.update({
        where: { id },
        data: {
          registrationDate: parsedDate,
          createdBy: userId
        }
      });
      return res.status(200).json({ timer });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Timer not found' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      const { id, userId } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Timer ID is required' });
      }
      if (typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.userList.findUnique({ where: { id: userId } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await prisma.registrationTimer.delete({ where: { id } });
      return res.status(200).json({ message: 'Timer deleted successfully' });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Timer not found' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  res.status(405).json({ error: `Method ${req.method} not allowed` });
}
