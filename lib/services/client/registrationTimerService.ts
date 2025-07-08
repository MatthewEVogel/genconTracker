export interface RegistrationTimer {
  id: string;
  registrationDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RegistrationTimerResponse {
  timer: RegistrationTimer | null;
}

export interface SetTimerRequest {
  id?: string;
  registrationDate: string;
  userId: string;
  timezoneOffsetMinutes: number;
}

export interface RegistrationStatusResponse {
  isOpen: boolean;
  timer?: RegistrationTimer;
  timeUntilOpen?: number; // milliseconds until registration opens
  timeRemaining?: string; // human readable time remaining
}

export class RegistrationTimerService {
  // Get the current registration timer
  static async getRegistrationTimer(): Promise<RegistrationTimerResponse> {
    const response = await fetch('/api/registration-timer');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch registration timer');
    }
    
    return data;
  }

  // Set or update registration timer (admin only)
  static async setRegistrationTimer(timerData: SetTimerRequest): Promise<RegistrationTimerResponse> {
    const method = timerData.id ? 'PUT' : 'POST';
    
    const response = await fetch('/api/registration-timer', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timerData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to set registration timer');
    }

    return data;
  }

  // Delete registration timer (admin only)
  static async deleteRegistrationTimer(timerId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/registration-timer/${timerId}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete registration timer');
    }

    return data;
  }

  // Get all registration timers (admin only)
  static async getAllRegistrationTimers(): Promise<{ timers: RegistrationTimer[] }> {
    const response = await fetch('/api/registration-timer/all');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch all registration timers');
    }

    return data;
  }

  // Check if registration is open
  static async getRegistrationStatus(): Promise<RegistrationStatusResponse> {
    const response = await fetch('/api/registration-timer/status');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch registration status');
    }
    
    return data;
  }

  // Get time remaining until registration opens
  static async getTimeUntilRegistration(): Promise<{
    timeRemaining: number; // milliseconds
    formattedTime: string; // human readable
    isOpen: boolean;
  }> {
    const timerResponse = await this.getRegistrationTimer();
    
    if (!timerResponse.timer) {
      return {
        timeRemaining: 0,
        formattedTime: 'No timer set',
        isOpen: false
      };
    }

    const now = new Date().getTime();
    const registrationTime = new Date(timerResponse.timer.registrationDate).getTime();
    const timeRemaining = registrationTime - now;

    if (timeRemaining <= 0) {
      return {
        timeRemaining: 0,
        formattedTime: 'Registration is open!',
        isOpen: true
      };
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    let formattedTime = '';
    if (days > 0) formattedTime += `${days}d `;
    if (hours > 0) formattedTime += `${hours}h `;
    if (minutes > 0) formattedTime += `${minutes}m `;
    if (seconds > 0) formattedTime += `${seconds}s`;

    return {
      timeRemaining,
      formattedTime: formattedTime.trim() || '0s',
      isOpen: false
    };
  }

  // Set timer for a specific date and time (helper method)
  static async setTimerForDateTime(
    dateTime: string,
    userId: string,
    existingTimerId?: string
  ): Promise<RegistrationTimerResponse> {
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();

    return await this.setRegistrationTimer({
      id: existingTimerId,
      registrationDate: dateTime,
      userId,
      timezoneOffsetMinutes,
    });
  }

  // Clear all timers (admin only)
  static async clearAllTimers(): Promise<{ message: string; deletedCount: number }> {
    const response = await fetch('/api/registration-timer/clear-all', {
      method: 'DELETE',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to clear all timers');
    }

    return data;
  }
}