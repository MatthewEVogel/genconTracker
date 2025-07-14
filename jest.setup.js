import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock environment variables for testing
// Use in-memory SQLite with PostgreSQL-compatible URL format for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.POSTGRES_PRISMA_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'

// Global test utilities
global.testUtils = {
  // Helper to create test users
  createTestUser: (name = 'TestUser') => ({
    id: `test-user-${Date.now()}-${Math.random()}`,
    name,
    createdAt: new Date(),
  }),
  
  // Helper to create test events
  createTestEvent: (overrides = {}) => ({
    id: `test-event-${Date.now()}-${Math.random()}`,
    title: 'Test Event',
    shortDescription: 'A test event',
    eventType: 'RPG',
    gameSystem: 'D&D 5E',
    startDateTime: '2024-08-01T10:00:00Z',
    duration: '4 hours',
    endDateTime: '2024-08-01T14:00:00Z',
    ageRequired: '13+',
    experienceRequired: 'None',
    materialsRequired: 'None',
    cost: '4',
    location: 'Room 101',
    ticketsAvailable: 6,
    createdAt: new Date(),
    ...overrides,
  }),
  
  // Helper to create test user events
  createTestUserEvent: (userId, eventId, priority = 1) => ({
    id: `test-user-event-${Date.now()}-${Math.random()}`,
    userId,
    eventId,
    priority,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}
