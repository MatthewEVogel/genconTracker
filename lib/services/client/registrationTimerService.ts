export interface RegistrationTimer {
  id: string;
  registrationDate: string;
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

export class RegistrationTimerService {
  static async getRegistrationTimer(): Promise<RegistrationTimerResponse> {
    const response = await fetch('/api/registration-timer');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch registration timer');
    }
    
    return data;
  }

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
}