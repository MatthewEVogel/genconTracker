import { personalEventService } from '../../../lib/services/client/personalEventService';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('PersonalEventService', () => {
  const mockPersonalEvent = {
    id: 'event1',
    title: 'Test Meeting',
    startTime: '2025-08-07T10:00:00.000Z',
    endTime: '2025-08-07T11:00:00.000Z',
    location: 'Conference Room A',
    createdBy: 'user1',
    attendees: [
      { userId: 'user1', personalEventId: 'event1' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPersonalEvent', () => {
    it('should create a personal event successfully', async () => {
      const mockResponse = {
        personalEvent: mockPersonalEvent,
        conflicts: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        location: 'Conference Room A',
        createdBy: 'user1',
        attendees: ['user1']
      };

      const result = await personalEventService.createPersonalEvent(eventData);

      expect(mockFetch).toHaveBeenCalledWith('/api/personal-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors during creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation failed' }),
      } as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: ['user1']
      };

      await expect(personalEventService.createPersonalEvent(eventData))
        .rejects.toThrow('Validation failed');
    });

    it('should handle network errors during creation', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: ['user1']
      };

      await expect(personalEventService.createPersonalEvent(eventData))
        .rejects.toThrow('Network error');
    });
  });

  describe('getPersonalEvents', () => {
    it('should fetch personal events for a user successfully', async () => {
      const mockEvents = [mockPersonalEvent];
      const mockResponse = { personalEvents: mockEvents };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await personalEventService.getPersonalEvents('user1');

      expect(mockFetch).toHaveBeenCalledWith('/api/personal-events?userId=user1');
      expect(result).toEqual(mockEvents);
    });

    it('should handle API errors during fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'User not found' }),
      } as Response);

      await expect(personalEventService.getPersonalEvents('user1'))
        .rejects.toThrow('Failed to fetch personal events');
    });

    it('should handle network errors during fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(personalEventService.getPersonalEvents('user1'))
        .rejects.toThrow('Network error');
    });
  });

  describe('updatePersonalEvent', () => {
    it('should update a personal event successfully', async () => {
      const updatedEvent = {
        ...mockPersonalEvent,
        title: 'Updated Meeting'
      };

      const mockResponse = {
        personalEvent: updatedEvent,
        conflicts: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const updateData = {
        id: 'event1',
        title: 'Updated Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        attendees: ['user1']
      };

      const result = await personalEventService.updatePersonalEvent(updateData);

      expect(mockFetch).toHaveBeenCalledWith('/api/personal-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      expect(result).toEqual(updatedEvent);
    });

    it('should handle API errors during update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Event not found' }),
      } as Response);

      const updateData = {
        id: 'event1',
        title: 'Updated Meeting',
        attendees: ['user1']
      };

      await expect(personalEventService.updatePersonalEvent(updateData))
        .rejects.toThrow('Event not found');
    });
  });

  describe('deletePersonalEvent', () => {
    it('should delete a personal event successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Personal event deleted successfully' }),
      } as Response);

      await personalEventService.deletePersonalEvent('event1');

      expect(mockFetch).toHaveBeenCalledWith('/api/personal-events', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 'event1' }),
      });
    });

    it('should handle API errors during deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Event not found' }),
      } as Response);

      await expect(personalEventService.deletePersonalEvent('event1'))
        .rejects.toThrow('Event not found');
    });

    it('should handle network errors during deletion', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(personalEventService.deletePersonalEvent('event1'))
        .rejects.toThrow('Network error');
    });
  });

  describe('roundToNearest15Minutes', () => {
    it('should round time to nearest 15 minutes', () => {
      // Test rounding down
      const time1 = new Date('2025-08-07T10:07:00.000Z');
      const rounded1 = personalEventService.roundToNearest15Minutes(time1);
      expect(rounded1.getUTCMinutes()).toBe(0);

      // Test rounding up
      const time2 = new Date('2025-08-07T10:08:00.000Z');
      const rounded2 = personalEventService.roundToNearest15Minutes(time2);
      expect(rounded2.getUTCMinutes()).toBe(15);

      // Test exact 15 minute mark
      const time3 = new Date('2025-08-07T10:15:00.000Z');
      const rounded3 = personalEventService.roundToNearest15Minutes(time3);
      expect(rounded3.getUTCMinutes()).toBe(15);

      // Test rounding to next hour
      const time4 = new Date('2025-08-07T10:53:00.000Z');
      const rounded4 = personalEventService.roundToNearest15Minutes(time4);
      expect(rounded4.getUTCMinutes()).toBe(0);
      expect(rounded4.getUTCHours()).toBe(11);
    });

    it('should clear seconds and milliseconds', () => {
      const time = new Date('2025-08-07T10:07:30.500Z');
      const rounded = personalEventService.roundToNearest15Minutes(time);
      expect(rounded.getUTCSeconds()).toBe(0);
      expect(rounded.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('getDefaultEndTime', () => {
    it('should return time 1 hour after start time', () => {
      const startTime = new Date('2025-08-07T10:00:00.000Z');
      const endTime = personalEventService.getDefaultEndTime(startTime);
      
      expect(endTime.getUTCHours()).toBe(11);
      expect(endTime.getUTCMinutes()).toBe(0);
      expect(endTime.getUTCDate()).toBe(startTime.getUTCDate());
    });

    it('should handle crossing day boundary', () => {
      const startTime = new Date('2025-08-07T23:30:00.000Z');
      const endTime = personalEventService.getDefaultEndTime(startTime);
      
      expect(endTime.getUTCHours()).toBe(0);
      expect(endTime.getUTCMinutes()).toBe(30);
      expect(endTime.getUTCDate()).toBe(8); // Next day
    });
  });

  describe('Error handling', () => {
    it('should handle responses without error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as unknown as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: ['user1']
      };

      await expect(personalEventService.createPersonalEvent(eventData))
        .rejects.toThrow('Failed to create personal event');
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => { throw new Error('Invalid JSON'); },
      } as unknown as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: ['user1']
      };

      await expect(personalEventService.createPersonalEvent(eventData))
        .rejects.toThrow('Invalid JSON');
    });
  });

  describe('Input validation', () => {
    it('should handle empty attendees array', async () => {
      const mockResponse = {
        personalEvent: { ...mockPersonalEvent, attendees: [] },
        conflicts: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: []
      };

      const result = await personalEventService.createPersonalEvent(eventData);

      expect(result.personalEvent.attendees).toEqual([]);
    });

    it('should handle optional location field', async () => {
      const mockResponse = {
        personalEvent: { ...mockPersonalEvent, location: undefined },
        conflicts: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const eventData = {
        title: 'Test Meeting',
        startTime: '2025-08-07T10:00:00.000Z',
        endTime: '2025-08-07T11:00:00.000Z',
        createdBy: 'user1',
        attendees: ['user1']
        // No location provided
      };

      const result = await personalEventService.createPersonalEvent(eventData);

      expect(result.personalEvent.location).toBeUndefined();
    });
  });
});
