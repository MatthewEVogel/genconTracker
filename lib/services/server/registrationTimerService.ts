import { prisma } from '@/lib/prisma';

export interface RegistrationTimer {
  id: string;
  registrationDate: Date;
  createdAt: Date;
  updatedAt: Date;
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

export class RegistrationTimerService {
  // Get the current registration timer
  static async getRegistrationTimer(): Promise<RegistrationTimerResponse> {
    const timer = await prisma.registrationTimer.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    return { timer };
  }

  // Set or update registration timer
  static async setRegistrationTimer(timerData: SetTimerRequest): Promise<RegistrationTimerResponse> {
    // Convert the local datetime to UTC
    const localDate = new Date(timerData.registrationDate);
    // Adjust for timezone offset (getTimezoneOffset returns negative for ahead of UTC)
    const utcDate = new Date(localDate.getTime() + (timerData.timezoneOffsetMinutes * 60000));

    let timer;

    if (timerData.id) {
      // Update existing timer
      timer = await prisma.registrationTimer.update({
        where: { id: timerData.id },
        data: {
          registrationDate: utcDate,
          createdBy: timerData.userId,
        }
      });
    } else {
      // Create new timer
      timer = await prisma.registrationTimer.create({
        data: {
          registrationDate: utcDate,
          createdBy: timerData.userId,
        }
      });
    }

    return { timer };
  }

  // Delete registration timer (admin only)
  static async deleteRegistrationTimer(timerId: string, userId: string) {
    // Verify the timer exists
    const timer = await prisma.registrationTimer.findUnique({
      where: { id: timerId }
    });

    if (!timer) {
      throw new Error('Timer not found');
    }

    await prisma.registrationTimer.delete({
      where: { id: timerId }
    });

    return { message: 'Registration timer deleted successfully' };
  }

  // Get all registration timers (admin only)
  static async getAllRegistrationTimers() {
    return await prisma.registrationTimer.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // Check if registration is open
  static async isRegistrationOpen(): Promise<{ isOpen: boolean; timer?: RegistrationTimer }> {
    const timerResponse = await this.getRegistrationTimer();
    
    if (!timerResponse.timer) {
      return { isOpen: false };
    }

    const now = new Date();
    const registrationDate = new Date(timerResponse.timer.registrationDate);
    
    return {
      isOpen: now >= registrationDate,
      timer: timerResponse.timer
    };
  }
}