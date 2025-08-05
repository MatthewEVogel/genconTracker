import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/users';

// Mock the prisma module
jest.mock('../../lib/prisma', () => ({
  prisma: {
    userList: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';

const mockUserListCreate = prisma.userList.create as jest.MockedFunction<typeof prisma.userList.create>;
const mockUserListFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;
const mockUserListFindMany = prisma.userList.findMany as jest.MockedFunction<typeof prisma.userList.findMany>;
const mockUserListUpdate = prisma.userList.update as jest.MockedFunction<typeof prisma.userList.update>;
const mockUserListDelete = prisma.userList.delete as jest.MockedFunction<typeof prisma.userList.delete>;

describe('/api/users', () => {
  const mockUser = {
    id: 'user1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    genConName: 'Test User',
    approved: true,
    isAdmin: false,
    provider: 'manual',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should fetch all approved users successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockUsers = [
        mockUser,
        {
          ...mockUser,
          id: 'user2',
          firstName: 'Another',
          lastName: 'User',
          email: 'another@example.com',
          genConName: 'Another User',
        }
      ];

      mockUserListFindMany.mockResolvedValue(mockUsers as any);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.users).toHaveLength(2);
      expect(responseData.users[0]).toEqual(
        expect.objectContaining({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        })
      );

      // Verify the query was called with correct parameters
      expect(mockUserListFindMany).toHaveBeenCalledWith({
        where: {
          approved: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          genConName: true,
          email: true,
          isAdmin: true
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      });
    });

    it('should return empty array when no approved users exist', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      mockUserListFindMany.mockResolvedValue([]);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.users).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      mockUserListFindMany.mockRejectedValue(new Error('Database connection failed'));

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com'
        }
      });

      mockUserListFindUnique.mockResolvedValue(null); // User doesn't exist
      mockUserListCreate.mockResolvedValue({
        ...mockUser,
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com'
      } as any);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.user).toEqual(
        expect.objectContaining({
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com'
        })
      );
    });

    it('should return existing user if email already exists', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      mockUserListFindUnique.mockResolvedValue(mockUser as any);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.user).toEqual(
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should validate required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          // Missing firstName
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'First name is required'
      });
    });

    it('should validate email format', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: 'invalid-email'
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid email format'
      });
    });
  });

  describe('PUT /api/users', () => {
    it('should update a user successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        body: {
          id: 'user1',
          firstName: 'Updated',
          lastName: 'User',
          email: 'updated@example.com',
          emailNotifications: true
        }
      });

      const updatedUser = {
        ...mockUser,
        firstName: 'Updated',
        email: 'updated@example.com',
        emailNotifications: true
      };

      mockUserListUpdate.mockResolvedValue(updatedUser as any);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.user).toEqual(
        expect.objectContaining({
          firstName: 'Updated',
          email: 'updated@example.com'
        })
      );
    });

    it('should validate required fields for update', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        body: {
          id: 'user1',
          // Missing firstName
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'First name is required'
      });
    });

    it('should require user ID', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User ID is required'
      });
    });
  });

  describe('DELETE /api/users', () => {
    it('should delete a user successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        body: {
          id: 'user1'
        }
      });

      mockUserListDelete.mockResolvedValue(mockUser as any);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'User deleted successfully'
      });
    });

    it('should require user ID for deletion', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        body: {}
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User ID is required'
      });
    });

    it('should handle user not found error', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        body: {
          id: 'nonexistent'
        }
      });

      const error = new Error('User not found');
      (error as any).code = 'P2025';
      mockUserListDelete.mockRejectedValue(error);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User not found'
      });
    });
  });

  describe('Method validation', () => {
    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method PATCH not allowed'
      });
    });

    it('should include correct Allow header for unsupported methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH'
      });

      await handler(req, res);

      expect(res.getHeader('Allow')).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors during user creation', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      mockUserListFindUnique.mockResolvedValue(null);
      mockUserListCreate.mockRejectedValue(new Error('Database error'));

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Internal server error'
      });
    });

    it('should handle unique constraint violations', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      mockUserListFindUnique.mockResolvedValue(null);
      const error = new Error('Unique constraint violation');
      (error as any).code = 'P2002';
      mockUserListCreate.mockRejectedValue(error);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Email already exists'
      });
    });
  });
});
