import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const { firstName, lastName, email } = req.body;

      // Validate required fields
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return res.status(400).json({ error: 'First name is required' });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return res.status(400).json({ error: 'Last name is required' });
      }
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedEmail = email.trim().toLowerCase();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Try to find existing user first
      let user = await prisma.user.findUnique({
        where: { email: trimmedEmail }
      });

      // If user doesn't exist, create a new one
      if (!user) {
        // Check if this is the admin account
        const isAdminAccount = trimmedEmail === 'matthewvogel1729@gmail.com' && 
                              trimmedFirstName === 'm-admin' && 
                              trimmedLastName === 'v-admin';
        
        user = await prisma.user.create({
          data: { 
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            isAdmin: isAdminAccount,
            provider: "manual"
          }
        });
      }

      res.status(200).json({ user });
    } catch (error: any) {
      console.error('Error creating/finding user:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, firstName, lastName, email, phoneNumber, emailNotifications, textNotifications } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Validate required fields
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return res.status(400).json({ error: 'First name is required' });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return res.status(400).json({ error: 'Last name is required' });
      }
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedEmail = email.trim().toLowerCase();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: { 
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
          phoneNumber: phoneNumber?.trim() || null,
          emailNotifications: emailNotifications || false,
          textNotifications: textNotifications || false
        }
      });

      res.status(200).json({ user });
    } catch (error: any) {
      console.error('Error updating user:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Email already exists' });
      } else if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id }
      });

      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
