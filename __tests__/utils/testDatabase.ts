import { PrismaClient } from '@prisma/client';

// Create a test database instance
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db'
    }
  }
});

export const testDatabase = {
  // Initialize test database
  async setup() {
    // This would typically set up test data or reset the database
    // For now, we'll just ensure the connection works
    try {
      await testPrisma.$connect();
      return true;
    } catch (error) {
      console.error('Test database setup failed:', error);
      return false;
    }
  },

  // Setup database for specific test type
  async setupDatabase(testType: string) {
    try {
      await testPrisma.$connect();
      // Clean up any existing test data
      await this.cleanupTestData();
      return true;
    } catch (error) {
      console.error(`Test database setup failed for ${testType}:`, error);
      return false;
    }
  },

  // Clean up test database
  async teardown() {
    try {
      await testPrisma.$disconnect();
      return true;
    } catch (error) {
      console.error('Test database teardown failed:', error);
      return false;
    }
  },

  // Clean up database
  async cleanupDatabase() {
    try {
      await this.cleanupTestData();
      await testPrisma.$disconnect();
      return true;
    } catch (error) {
      console.error('Test database cleanup failed:', error);
      return false;
    }
  },

  // Get the test prisma instance
  getPrisma() {
    return testPrisma;
  },

  // Helper to create test user
  async createTestUser(userData: any) {
    return await testPrisma.userList.create({
      data: userData
    });
  },

  // Helper to create test event
  async createTestEvent(eventData: any) {
    return await testPrisma.eventsList.create({
      data: eventData
    });
  },

  // Helper to create test desired event
  async createTestDesiredEvent(desiredEventData: any) {
    return await testPrisma.desiredEvents.create({
      data: desiredEventData
    });
  },

  // Helper to clean up all test data
  async cleanupTestData() {
    try {
      // Clean up in reverse dependency order
      await testPrisma.desiredEvents.deleteMany({});
      await testPrisma.eventsList.deleteMany({});
      await testPrisma.userList.deleteMany({});
      return true;
    } catch (error) {
      console.error('Test data cleanup failed:', error);
      return false;
    }
  }
};
