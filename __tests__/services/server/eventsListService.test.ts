import { EventsListService } from '@/lib/services/server/eventsListService';

// Mock Prisma
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    eventsList: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
    }
  }
}));

describe('EventsListService Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvents = [
    {
      id: 'RPG25ND272941',
      title: 'Dread: Victim\'s Choice',
      shortDescription: 'A horror RPG experience',
      eventType: 'RPG',
      gameSystem: 'Dread',
      startDateTime: '2025-08-14T10:00:00Z',
      endDateTime: '2025-08-14T14:00:00Z',
      ageRequired: '18+',
      experienceRequired: 'None',
      materialsRequired: 'None',
      cost: '8',
      location: 'ICC Room 101',
      ticketsAvailable: 6,
      priority: 1,
      isCanceled: false
    },
    {
      id: 'MHE25ND271404',
      title: 'Kefa\'s Intro to Miniature Painting',
      shortDescription: 'Learn miniature painting basics',
      eventType: 'MHE',
      gameSystem: null,
      startDateTime: '2025-08-15T09:00:00Z',
      endDateTime: '2025-08-15T12:00:00Z',
      ageRequired: '12+',
      experienceRequired: 'Beginner',
      materialsRequired: 'Provided',
      cost: '15',
      location: 'ICC Room 202',
      ticketsAvailable: 12,
      priority: 2,
      isCanceled: false
    },
    {
      id: 'ZED25ND275584',
      title: 'Blood on the Clocktower: Trouble Brewing LTP',
      shortDescription: 'Social deduction game',
      eventType: 'ZED',
      gameSystem: 'Blood on the Clocktower',
      startDateTime: '2025-08-16T19:00:00Z',
      endDateTime: '2025-08-16T23:00:00Z',
      ageRequired: '16+',
      experienceRequired: 'Some',
      materialsRequired: 'None',
      cost: '0',
      location: 'ICC Room 303',
      ticketsAvailable: 20,
      priority: 3,
      isCanceled: false
    }
  ];

  describe('Duration Calculation', () => {
    test('should calculate duration correctly for same-day events', () => {
      const duration = EventsListService.calculateDuration(
        '2025-08-14T10:00:00Z',
        '2025-08-14T14:00:00Z'
      );
      expect(duration).toBe('4h');
    });

    test('should calculate duration with minutes', () => {
      const duration = EventsListService.calculateDuration(
        '2025-08-14T10:00:00Z',
        '2025-08-14T12:30:00Z'
      );
      expect(duration).toBe('2h 30m');
    });

    test('should handle events crossing day boundaries', () => {
      const duration = EventsListService.calculateDuration(
        '2025-08-14T23:00:00Z',
        '2025-08-15T02:00:00Z'
      );
      expect(duration).toBe('3h');
    });

    test('should return null for missing start or end time', () => {
      expect(EventsListService.calculateDuration(null, '2025-08-14T14:00:00Z')).toBeNull();
      expect(EventsListService.calculateDuration('2025-08-14T10:00:00Z', null)).toBeNull();
      expect(EventsListService.calculateDuration(null, null)).toBeNull();
    });

    test('should handle invalid date strings gracefully', () => {
      const duration = EventsListService.calculateDuration(
        'invalid-date',
        '2025-08-14T14:00:00Z'
      );
      expect(duration).toBeNull();
    });
  });

  describe('Get Events - No Filters', () => {
    test('should return paginated events without filters', async () => {
      mockCount.mockResolvedValue(100);
      mockFindMany.mockResolvedValue(mockEvents);

      const result = await EventsListService.getEvents({ page: 1, limit: 10 });

      expect(result.events).toHaveLength(3);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 10,
        totalEvents: 100,
        hasNextPage: true,
        hasPrevPage: false
      });

      // Verify duration is calculated
      expect(result.events[0].duration).toBe('4h');
      expect(result.events[1].duration).toBe('3h');
      expect(result.events[2].duration).toBe('4h');
    });

    test('should handle default pagination values', async () => {
      mockCount.mockResolvedValue(50);
      mockFindMany.mockResolvedValue(mockEvents);

      const result = await EventsListService.getEvents({});

      expect(mockFindMany).toHaveBeenCalledWith({
        skip: 0,
        take: 100,
        orderBy: { startDateTime: 'asc' },
        select: expect.any(Object)
      });

      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalEvents).toBe(50);
    });
  });

  describe('Get Events - With Filters', () => {
    beforeEach(() => {
      mockFindMany.mockResolvedValue(mockEvents);
    });

    test('should filter by search term', async () => {
      const result = await EventsListService.getEvents({ search: 'dread' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toContain('Dread');
    });

    test('should filter by event type', async () => {
      const result = await EventsListService.getEvents({ eventTypes: 'RPG' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('RPG');
    });

    test('should filter by age rating', async () => {
      const result = await EventsListService.getEvents({ ageRatings: '18+' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].ageRequired).toBe('18+');
    });

    test('should filter by day of week', async () => {
      // Mock events with specific dates for different days
      const thursdayEvent = { ...mockEvents[0], startDateTime: '2025-08-14T10:00:00Z' }; // Thursday
      const fridayEvent = { ...mockEvents[1], startDateTime: '2025-08-15T10:00:00Z' }; // Friday
      
      mockFindMany.mockResolvedValue([thursdayEvent, fridayEvent]);

      const result = await EventsListService.getEvents({ day: 'Thursday' });

      expect(result.events).toHaveLength(1);
    });

    test('should filter by start time', async () => {
      const result = await EventsListService.getEvents({ startTime: '12:00' });

      // Should include events starting at or after 12:00
      expect(result.events.length).toBeGreaterThan(0);
    });

    test('should filter by end time', async () => {
      const result = await EventsListService.getEvents({ endTime: '15:00' });

      // Should include events ending at or before 15:00
      expect(result.events.length).toBeGreaterThan(0);
    });

    test('should filter by max participants', async () => {
      const result = await EventsListService.getEvents({ maxParticipants: '10' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].ticketsAvailable).toBeLessThanOrEqual(10);
    });

    test('should handle multiple filters simultaneously', async () => {
      const result = await EventsListService.getEvents({
        search: 'painting',
        eventTypes: 'MHE',
        ageRatings: '12+'
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toContain('Painting');
      expect(result.events[0].eventType).toBe('MHE');
      expect(result.events[0].ageRequired).toBe('12+');
    });

    test('should handle comma-separated filter values', async () => {
      const result = await EventsListService.getEvents({
        eventTypes: 'RPG,MHE'
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.map(e => e.eventType)).toEqual(expect.arrayContaining(['RPG', 'MHE']));
    });
  });

  describe('Get Filter Options', () => {
    test('should return unique age ratings and event types', async () => {
      mockFindMany.mockResolvedValue([
        { ageRequired: '18+', eventType: 'RPG' },
        { ageRequired: '12+', eventType: 'MHE' },
        { ageRequired: '18+', eventType: 'ZED' },
        { ageRequired: null, eventType: null }
      ]);

      const result = await EventsListService.getFilterOptions();

      expect(result.ageRatings).toEqual(expect.arrayContaining(['12+', '18+', 'Not Specified']));
      expect(result.eventTypes).toEqual(expect.arrayContaining(['MHE', 'RPG', 'ZED', 'Not Specified']));
      expect(result.ageRatings).toHaveLength(3);
      expect(result.eventTypes).toHaveLength(4);
    });

    test('should sort filter options alphabetically', async () => {
      mockFindMany.mockResolvedValue([
        { ageRequired: 'Z-Rating', eventType: 'Z-Type' },
        { ageRequired: 'A-Rating', eventType: 'A-Type' },
        { ageRequired: 'M-Rating', eventType: 'M-Type' }
      ]);

      const result = await EventsListService.getFilterOptions();

      expect(result.ageRatings[0]).toBe('A-Rating');
      expect(result.ageRatings[result.ageRatings.length - 1]).toBe('Z-Rating');
      expect(result.eventTypes[0]).toBe('A-Type');
      expect(result.eventTypes[result.eventTypes.length - 1]).toBe('Z-Type');
    });
  });

  describe('Get Event By ID', () => {
    test('should return event with calculated duration', async () => {
      mockFindUnique.mockResolvedValue(mockEvents[0]);

      const result = await EventsListService.getEventById('RPG25ND272941');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('RPG25ND272941');
      expect(result!.duration).toBe('4h');
    });

    test('should return null for non-existent event', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await EventsListService.getEventById('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty search term', async () => {
      const result = await EventsListService.getEvents({ search: '   ' });

      // Should return all events when search is empty/whitespace
      expect(result.events).toHaveLength(3);
    });

    test('should handle invalid max participants', async () => {
      const result = await EventsListService.getEvents({ maxParticipants: 'invalid' });

      // Should ignore invalid maxParticipants filter
      expect(result.events).toHaveLength(3);
    });

    test('should handle events with null date fields gracefully', async () => {
      const eventsWithNullDates = [
        { ...mockEvents[0], startDateTime: null, endDateTime: null }
      ];
      mockFindMany.mockResolvedValue(eventsWithNullDates);

      const result = await EventsListService.getEvents({ day: 'Thursday' });

      // Events with null dates should be filtered out when filtering by day
      expect(result.events).toHaveLength(0);
    });

    test('should handle case-insensitive search', async () => {
      const result = await EventsListService.getEvents({ search: 'DREAD' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title.toLowerCase()).toContain('dread');
    });

    test('should search across multiple fields', async () => {
      // Test searching by event ID
      let result = await EventsListService.getEvents({ search: 'RPG25ND272941' });
      expect(result.events).toHaveLength(1);

      // Test searching by game system
      result = await EventsListService.getEvents({ search: 'Dread' });
      expect(result.events).toHaveLength(1);

      // Test searching by description
      result = await EventsListService.getEvents({ search: 'horror' });
      expect(result.events).toHaveLength(1);
    });
  });

  describe('Performance and Pagination', () => {
    test('should handle large page numbers', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindMany.mockResolvedValue([]);

      const result = await EventsListService.getEvents({ page: 100, limit: 10 });

      expect(result.pagination.currentPage).toBe(100);
      expect(result.pagination.totalPages).toBe(100);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    test('should handle zero results', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await EventsListService.getEvents({ search: 'nonexistent' });

      expect(result.events).toHaveLength(0);
      expect(result.pagination.totalEvents).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    test('should use efficient querying for filtered results', async () => {
      await EventsListService.getEvents({ search: 'test' });

      // Should call findMany once to get all events for filtering
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockCount).not.toHaveBeenCalled();
    });
  });
});
