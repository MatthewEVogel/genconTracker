// Mock fetch globally
global.fetch = jest.fn();

import { EventService } from '@/lib/services/client/eventService';

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('EventService Tracking Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should track an event successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ message: 'Event tracking enabled successfully' }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await EventService.trackEvent('event1');

      expect(mockFetch).toHaveBeenCalledWith('/api/events/event1/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should throw error when tracking fails', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Event not found' }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.trackEvent('nonexistent')).rejects.toThrow('Event not found');
    });

    it('should throw default error when no error message provided', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({}),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.trackEvent('event1')).rejects.toThrow('Failed to track event');
    });
  });

  describe('untrackEvent', () => {
    it('should untrack an event successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ message: 'Event tracking disabled successfully' }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await EventService.untrackEvent('event1');

      expect(mockFetch).toHaveBeenCalledWith('/api/events/event1/track', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should throw error when untracking fails', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.untrackEvent('event1')).rejects.toThrow('Unauthorized');
    });

    it('should throw default error when no error message provided', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({}),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.untrackEvent('event1')).rejects.toThrow('Failed to untrack event');
    });
  });

  describe('getTrackedEvents', () => {
    it('should return tracked events successfully', async () => {
      const mockTrackedEvents = [
        {
          id: 'event1',
          title: 'Test Event 1',
          startDateTime: '2025-08-15T10:00:00Z',
          endDateTime: '2025-08-15T14:00:00Z',
          eventType: 'RPG',
          location: 'Room 101',
          cost: '10',
          ticketsAvailable: 6,
          isCanceled: false,
        },
        {
          id: 'event2',
          title: 'Test Event 2',
          startDateTime: '2025-08-16T10:00:00Z',
          endDateTime: '2025-08-16T14:00:00Z',
          eventType: 'TCG',
          location: 'Room 102',
          cost: '5',
          ticketsAvailable: 8,
          isCanceled: false,
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({ trackedEvents: mockTrackedEvents }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      const result = await EventService.getTrackedEvents();

      expect(mockFetch).toHaveBeenCalledWith('/api/user-tracked-events');
      expect(result).toEqual(mockTrackedEvents);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('event1');
      expect(result[1].id).toBe('event2');
    });

    it('should return empty array when no tracked events', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ trackedEvents: [] }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      const result = await EventService.getTrackedEvents();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw error when fetching tracked events fails', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.getTrackedEvents()).rejects.toThrow('Unauthorized');
    });

    it('should throw default error when no error message provided', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({}),
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(EventService.getTrackedEvents()).rejects.toThrow('Failed to fetch tracked events');
    });
  });

  describe('network errors', () => {
    it('should handle network errors in trackEvent', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(EventService.trackEvent('event1')).rejects.toThrow('Network error');
    });

    it('should handle network errors in untrackEvent', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(EventService.untrackEvent('event1')).rejects.toThrow('Network error');
    });

    it('should handle network errors in getTrackedEvents', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(EventService.getTrackedEvents()).rejects.toThrow('Network error');
    });
  });
});