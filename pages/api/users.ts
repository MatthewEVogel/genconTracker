import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const trimmedName = name.trim();

      // Try to find existing user first
      let user = await prisma.user.findUnique({
        where: { name: trimmedName }
      });

      // If user doesn't exist, create a new one
      if (!user) {
        user = await prisma.user.create({
          data: { name: trimmedName }
        });
      }

      res.status(200).json({ user });
    } catch (error) {
      console.error('Error creating/finding user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
