import { RegistrationTimerService } from '@/lib/services/server/registrationTimerService';
import { testDatabase } from './utils/testDatabase';

describe('RegistrationTimerService', () => {
  beforeEach(async () => {
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  describe('getRegistrationTimer', () => {
    it('should return null when no timer is set', async () => {
      const result = await RegistrationTimerService.getRegistrationTimer();

      expect(result.timer).toBeNull();
    });

    it('should return active timer when one exists', async () => {
      // Create a timer first
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const timerData = {
        registrationDate: futureDate.toISOString(),
        userId: 'test-user',
        timezoneOffsetMinutes: 0
      };

      await RegistrationTimerService.setRegistrationTimer(timerData);

      const result = await RegistrationTimerService.getRegistrationTimer();

      expect(result.timer).toBeDefined();
      expect(result.timer!.createdBy).toBe('test-user');
      expect(new Date(result.timer!.registrationDate)).toEqual(futureDate);
    });
  });

  describe('setRegistrationTimer', () => {
    it('should create a new registration timer', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const timerData = {
        registrationDate: futureDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      };

      const result = await RegistrationTimerService.setRegistrationTimer(timerData);

      expect(result.timer).toBeDefined();
      expect(result.timer!.createdBy).toBe('admin-user');
      expect(new Date(result.timer!.registrationDate)).toEqual(futureDate);
    });

    it('should update existing timer when ID is provided', async () => {
      // Create first timer
      const firstDate = new Date();
      firstDate.setHours(firstDate.getHours() + 1);

      const createResult = await RegistrationTimerService.setRegistrationTimer({
        registrationDate: firstDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      // Update the timer
      const secondDate = new Date();
      secondDate.setHours(secondDate.getHours() + 3);

      const updateResult = await RegistrationTimerService.setRegistrationTimer({
        id: createResult.timer!.id,
        registrationDate: secondDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      expect(updateResult.timer!.id).toBe(createResult.timer!.id);
      expect(updateResult.timer!.createdBy).toBe('admin-user');
      expect(new Date(updateResult.timer!.registrationDate)).toEqual(secondDate);
    });

    it('should handle timezone offset correctly', async () => {
      const localDate = new Date();
      localDate.setHours(localDate.getHours() + 1);

      // Test with EST timezone offset (-5 hours = -300 minutes)
      const timerData = {
        registrationDate: localDate.toISOString(),
        userId: 'test-user',
        timezoneOffsetMinutes: -300 // EST offset
      };

      const result = await RegistrationTimerService.setRegistrationTimer(timerData);

      expect(result.timer).toBeDefined();
      // The stored date should be adjusted for timezone
      const storedDate = new Date(result.timer!.registrationDate);
      const expectedDate = new Date(localDate.getTime() + (-300 * 60000));
      expect(storedDate).toEqual(expectedDate);
    });
  });

  describe('deleteRegistrationTimer', () => {
    it('should delete existing timer successfully', async () => {
      // Create a timer first
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const createResult = await RegistrationTimerService.setRegistrationTimer({
        registrationDate: futureDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      // Delete the timer
      const deleteResult = await RegistrationTimerService.deleteRegistrationTimer(
        createResult.timer!.id, 
        'admin-user'
      );

      expect(deleteResult.message).toBe('Registration timer deleted successfully');

      // Verify timer is deleted
      const getResult = await RegistrationTimerService.getRegistrationTimer();
      expect(getResult.timer).toBeNull();
    });

    it('should throw error when deleting non-existent timer', async () => {
      await expect(
        RegistrationTimerService.deleteRegistrationTimer('non-existent-id', 'admin-user')
      ).rejects.toThrow('Timer not found');
    });
  });

  describe('getAllRegistrationTimers', () => {
    it('should return empty array when no timers exist', async () => {
      const result = await RegistrationTimerService.getAllRegistrationTimers();

      expect(result).toHaveLength(0);
    });

    it('should return all timers ordered by creation date', async () => {
      // Create multiple timers
      const timer1Date = new Date();
      timer1Date.setHours(timer1Date.getHours() + 1);

      const timer2Date = new Date();
      timer2Date.setHours(timer2Date.getHours() + 2);

      await RegistrationTimerService.setRegistrationTimer({
        registrationDate: timer1Date.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      // Wait a bit to ensure different creation times
      await new Promise(resolve => setTimeout(resolve, 10));

      await RegistrationTimerService.setRegistrationTimer({
        registrationDate: timer2Date.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      const result = await RegistrationTimerService.getAllRegistrationTimers();

      expect(result).toHaveLength(2);
      expect(result[0].createdBy).toBe('admin-user');
      // Should be ordered by creation date descending (newest first)
      expect(new Date(result[0].createdAt).getTime()).toBeGreaterThan(
        new Date(result[1].createdAt).getTime()
      );
    });
  });

  describe('isRegistrationOpen', () => {
    it('should return false when no timer is set', async () => {
      const result = await RegistrationTimerService.isRegistrationOpen();

      expect(result.isOpen).toBe(false);
      expect(result.timer).toBeUndefined();
    });

    it('should return false when registration time has not arrived', async () => {
      // Set timer for future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      await RegistrationTimerService.setRegistrationTimer({
        registrationDate: futureDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      const result = await RegistrationTimerService.isRegistrationOpen();

      expect(result.isOpen).toBe(false);
      expect(result.timer).toBeDefined();
      expect(result.timer?.createdBy).toBe('admin-user');
    });

    it('should return true when registration time has passed', async () => {
      // Set timer for past
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      await RegistrationTimerService.setRegistrationTimer({
        registrationDate: pastDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      const result = await RegistrationTimerService.isRegistrationOpen();

      expect(result.isOpen).toBe(true);
      expect(result.timer).toBeDefined();
      expect(result.timer?.createdBy).toBe('admin-user');
    });

    it('should return true when registration time is exactly now', async () => {
      // Set timer for current time (within a few seconds)
      const nowDate = new Date();

      await RegistrationTimerService.setRegistrationTimer({
        registrationDate: nowDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      });

      const result = await RegistrationTimerService.isRegistrationOpen();

      expect(result.isOpen).toBe(true);
      expect(result.timer).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid date formats gracefully', async () => {
      const timerData = {
        registrationDate: 'invalid-date-string',
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      };

      // This should throw an error due to invalid date
      await expect(
        RegistrationTimerService.setRegistrationTimer(timerData)
      ).rejects.toThrow();
    });

    it('should handle different timezone offsets', async () => {
      const baseDate = new Date();
      baseDate.setHours(baseDate.getHours() + 1);

      // Test with different timezone offsets
      const timezones = [
        { offset: 0, name: 'UTC' },
        { offset: -300, name: 'EST' },
        { offset: 300, name: 'CET' },
        { offset: -480, name: 'PST' }
      ];

      for (const tz of timezones) {
        const result = await RegistrationTimerService.setRegistrationTimer({
          registrationDate: baseDate.toISOString(),
          userId: `user-${tz.name}`,
          timezoneOffsetMinutes: tz.offset
        });

        expect(result.timer).toBeDefined();
        expect(result.timer!.createdBy).toBe(`user-${tz.name}`);

        // Clean up for next iteration
        await RegistrationTimerService.deleteRegistrationTimer(result.timer!.id, `user-${tz.name}`);
      }
    });

    it('should handle concurrent timer operations', async () => {
      const futureDate1 = new Date();
      futureDate1.setHours(futureDate1.getHours() + 1);

      const futureDate2 = new Date();
      futureDate2.setHours(futureDate2.getHours() + 2);

      // Try to create two timers concurrently
      const promises = [
        RegistrationTimerService.setRegistrationTimer({
          registrationDate: futureDate1.toISOString(),
          userId: 'user-1',
          timezoneOffsetMinutes: 0
        }),
        RegistrationTimerService.setRegistrationTimer({
          registrationDate: futureDate2.toISOString(),
          userId: 'user-2',
          timezoneOffsetMinutes: 0
        })
      ];

      const results = await Promise.all(promises);

      // Both should succeed since they create separate timers
      expect(results[0].timer).toBeDefined();
      expect(results[1].timer).toBeDefined();

      // Verify both timers exist
      const allTimers = await RegistrationTimerService.getAllRegistrationTimers();
      expect(allTimers).toHaveLength(2);
    });

    it('should handle past dates when setting timer', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const timerData = {
        registrationDate: pastDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 0
      };

      const result = await RegistrationTimerService.setRegistrationTimer(timerData);

      expect(result.timer).toBeDefined();
      expect(result.timer!.createdBy).toBe('admin-user');

      // Should immediately show as open
      const openResult = await RegistrationTimerService.isRegistrationOpen();
      expect(openResult.isOpen).toBe(true);
    });

    it('should handle extreme timezone offsets', async () => {
      const baseDate = new Date();
      baseDate.setHours(baseDate.getHours() + 1);

      // Test with extreme timezone offset (UTC+14)
      const timerData = {
        registrationDate: baseDate.toISOString(),
        userId: 'admin-user',
        timezoneOffsetMinutes: 840 // UTC+14 (840 minutes)
      };

      const result = await RegistrationTimerService.setRegistrationTimer(timerData);

      expect(result.timer).toBeDefined();
      
      // The stored date should be adjusted for the extreme timezone
      const storedDate = new Date(result.timer!.registrationDate);
      const expectedDate = new Date(baseDate.getTime() + (840 * 60000));
      expect(storedDate).toEqual(expectedDate);
    });
  });
});
