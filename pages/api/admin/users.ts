import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId || typeof adminUserId !== 'string') {
        return res.status(400).json({ error: 'Admin user ID is required' });
      }

      // Verify the requesting user is an admin
      const adminUser = await prisma.user.findUnique({
        where: { id: adminUserId }
      });

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Get all users
      const users = await prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: {
              userEvents: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({ users });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { adminUserId, userIdToDelete } = req.body;

      if (!adminUserId || typeof adminUserId !== 'string') {
        return res.status(400).json({ error: 'Admin user ID is required' });
      }

      if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        return res.status(400).json({ error: 'User ID to delete is required' });
      }

      // Verify the requesting user is an admin
      const adminUser = await prisma.user.findUnique({
        where: { id: adminUserId }
      });

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Prevent admin from deleting themselves
      if (adminUserId === userIdToDelete) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
      }

      // Get user to delete for logging
      const userToDelete = await prisma.user.findUnique({
        where: { id: userIdToDelete },
        select: { firstName: true, lastName: true, email: true, isAdmin: true }
      });

      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting other admin accounts
      if (userToDelete.isAdmin) {
        return res.status(400).json({ error: 'Cannot delete other admin accounts' });
      }

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id: userIdToDelete }
      });

      console.log(`Admin ${adminUser.email} deleted user: ${userToDelete.email}`);
      res.status(200).json({ 
        message: 'User deleted successfully',
        deletedUser: {
          firstName: userToDelete.firstName,
          lastName: userToDelete.lastName,
          email: userToDelete.email
        }
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
