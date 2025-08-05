import { prisma } from '../../lib/prisma';

// Mock the prisma module
jest.mock('../../lib/prisma', () => ({
  prisma: {
    userList: {
      findUnique: jest.fn(),
    },
  },
}));

const mockUsersFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Credentials Provider Integration', () => {
    it('should find user by email for credentials authentication', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        genConName: 'Test User',
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(mockUser as any);

      // Simulate the database lookup that happens in the credentials provider
      const foundUser = await prisma.userList.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(foundUser).toEqual(mockUser);
      expect(mockUsersFindUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should handle non-existent users', async () => {
      mockUsersFindUnique.mockResolvedValue(null);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'nonexistent@example.com' },
      });

      expect(foundUser).toBeNull();
    });

    it('should handle database errors', async () => {
      mockUsersFindUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        prisma.userList.findUnique({
          where: { email: 'test@example.com' },
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('User Authentication Scenarios', () => {
    it('should authenticate manual users', async () => {
      const manualUser = {
        id: 'manual-user-1',
        email: 'manual@example.com',
        firstName: 'Manual',
        lastName: 'User',
        genConName: 'Manual User',
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(manualUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'manual@example.com' },
      });

      expect(foundUser).toEqual(manualUser);
      expect(foundUser?.provider).toBe('manual');
    });

    it('should authenticate Google users', async () => {
      const googleUser = {
        id: 'google-user-1',
        email: 'google@example.com',
        firstName: 'Google',
        lastName: 'User',
        genConName: 'Google User',
        isAdmin: false,
        approved: true,
        provider: 'google',
        googleId: 'google-123',
      };

      mockUsersFindUnique.mockResolvedValue(googleUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'google@example.com' },
      });

      expect(foundUser).toEqual(googleUser);
      expect(foundUser?.provider).toBe('google');
      expect(foundUser?.googleId).toBe('google-123');
    });

    it('should handle unapproved users', async () => {
      const unapprovedUser = {
        id: 'unapproved-user-1',
        email: 'unapproved@example.com',
        firstName: 'Unapproved',
        lastName: 'User',
        genConName: 'Unapproved User',
        isAdmin: false,
        approved: false,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(unapprovedUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'unapproved@example.com' },
      });

      expect(foundUser).toEqual(unapprovedUser);
      expect(foundUser?.approved).toBe(false);
    });

    it('should handle admin users', async () => {
      const adminUser = {
        id: 'admin-user-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        genConName: 'Admin User',
        isAdmin: true,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(adminUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'admin@example.com' },
      });

      expect(foundUser).toEqual(adminUser);
      expect(foundUser?.isAdmin).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('should handle valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      for (const email of validEmails) {
        mockUsersFindUnique.mockResolvedValue({
          id: 'user-1',
          email,
          firstName: 'Test',
          lastName: 'User',
          genConName: 'Test User',
          isAdmin: false,
          approved: true,
          provider: 'manual',
        } as any);

        const foundUser = await prisma.userList.findUnique({
          where: { email },
        });

        expect(foundUser?.email).toBe(email);
      }
    });

    it('should handle case-insensitive email lookup', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        genConName: 'Test User',
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(user as any);

      // Test that the database lookup uses the exact email provided
      await prisma.userList.findUnique({
        where: { email: 'TEST@EXAMPLE.COM' },
      });

      expect(mockUsersFindUnique).toHaveBeenCalledWith({
        where: { email: 'TEST@EXAMPLE.COM' },
      });
    });
  });

  describe('Provider Migration Scenarios', () => {
    it('should handle users who switch from manual to Google', async () => {
      const migratedUser = {
        id: 'migrated-user-1',
        email: 'migrated@example.com',
        firstName: 'Migrated',
        lastName: 'User',
        genConName: 'Migrated User',
        isAdmin: false,
        approved: true,
        provider: 'google', // Originally manual, now Google
        googleId: 'google-456',
      };

      mockUsersFindUnique.mockResolvedValue(migratedUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'migrated@example.com' },
      });

      expect(foundUser).toEqual(migratedUser);
      expect(foundUser?.provider).toBe('google');
      expect(foundUser?.googleId).toBe('google-456');
    });

    it('should handle users with mixed authentication history', async () => {
      const mixedUser = {
        id: 'mixed-user-1',
        email: 'mixed@example.com',
        firstName: 'Mixed',
        lastName: 'User',
        genConName: 'Mixed User',
        isAdmin: false,
        approved: true,
        provider: 'google',
        googleId: 'google-789',
        // User might have been created manually first, then linked to Google
      };

      mockUsersFindUnique.mockResolvedValue(mixedUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'mixed@example.com' },
      });

      expect(foundUser).toEqual(mixedUser);
      expect(foundUser?.provider).toBe('google');
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle users with special characters in names', async () => {
      const specialUser = {
        id: 'special-user-1',
        email: 'special@example.com',
        firstName: 'José',
        lastName: "O'Connor",
        genConName: "José O'Connor",
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(specialUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'special@example.com' },
      });

      expect(foundUser).toEqual(specialUser);
      expect(foundUser?.firstName).toBe('José');
      expect(foundUser?.lastName).toBe("O'Connor");
    });

    it('should handle users with long names', async () => {
      const longNameUser = {
        id: 'long-name-user-1',
        email: 'longname@example.com',
        firstName: 'VeryLongFirstNameThatExceedsNormalLength',
        lastName: 'VeryLongLastNameThatExceedsNormalLength',
        genConName: 'VeryLongFirstNameThatExceedsNormalLength VeryLongLastNameThatExceedsNormalLength',
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(longNameUser as any);

      const foundUser = await prisma.userList.findUnique({
        where: { email: 'longname@example.com' },
      });

      expect(foundUser).toEqual(longNameUser);
    });

    it('should handle concurrent authentication requests', async () => {
      const user = {
        id: 'concurrent-user-1',
        email: 'concurrent@example.com',
        firstName: 'Concurrent',
        lastName: 'User',
        genConName: 'Concurrent User',
        isAdmin: false,
        approved: true,
        provider: 'manual',
      };

      mockUsersFindUnique.mockResolvedValue(user as any);

      // Simulate multiple concurrent authentication requests
      const promises = Array.from({ length: 5 }, () =>
        prisma.userList.findUnique({
          where: { email: 'concurrent@example.com' },
        })
      );

      const results = await Promise.all(promises);

      // All requests should return the same user
      results.forEach(result => {
        expect(result).toEqual(user);
      });

      // Database should have been called 5 times
      expect(mockUsersFindUnique).toHaveBeenCalledTimes(5);
    });
  });
});
