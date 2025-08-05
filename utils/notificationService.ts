import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}


export interface NotificationData {
  type: 'registration_reminder' | 'event_update';
  timeUntilRegistration?: string;
  registrationDate?: string;
  message: string;
  eventTitle?: string;
  changes?: string[];
}

export async function sendRegistrationReminders(registrationDate: Date) {
  const now = new Date();
  const timeUntilRegistration = registrationDate.getTime() - now.getTime();
  
  // Define reminder intervals (in milliseconds)
  const intervals = {
    '1_day': 24 * 60 * 60 * 1000,     // 1 day
    '6_hours': 6 * 60 * 60 * 1000,    // 6 hours
    '30_minutes': 30 * 60 * 1000       // 30 minutes
  };

  // Check which reminder to send
  let reminderType: string | null = null;
  let timeLabel: string = '';

  if (timeUntilRegistration <= intervals['30_minutes'] && timeUntilRegistration > intervals['30_minutes'] - 60000) {
    reminderType = '30_minutes';
    timeLabel = '30 minutes';
  } else if (timeUntilRegistration <= intervals['6_hours'] && timeUntilRegistration > intervals['6_hours'] - 60000) {
    reminderType = '6_hours';
    timeLabel = '6 hours';
  } else if (timeUntilRegistration <= intervals['1_day'] && timeUntilRegistration > intervals['1_day'] - 60000) {
    reminderType = '1_day';
    timeLabel = '1 day';
  }

  if (!reminderType) {
    return { sent: false, reason: 'No reminder needed at this time' };
  }

  // Get all users with email notifications enabled
  const usersWithNotifications = await prisma.userList.findMany({
    where: {
      emailNotifications: true
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailNotifications: true
    }
  });

  const notificationData: NotificationData = {
    type: 'registration_reminder',
    timeUntilRegistration: timeLabel,
    registrationDate: registrationDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    message: `GenCon event registration opens in ${timeLabel}! Get ready to secure your tickets.`
  };

  const results = {
    emailsSent: 0,
    errors: [] as string[]
  };

  // Send email notifications to each user
  for (const user of usersWithNotifications) {
    try {
      await sendEmailNotification(user, notificationData);
      results.emailsSent++;
    } catch (error) {
      console.error(`Failed to send notification to user ${user.id}:`, error);
      results.errors.push(`Failed to notify ${user.firstName} ${user.lastName}: ${error}`);
    }
  }

  return {
    sent: true,
    reminderType,
    timeLabel,
    usersNotified: usersWithNotifications.length,
    ...results
  };
}

async function sendEmailNotification(user: any, data: NotificationData) {
  let emailContent;

  if (data.type === 'event_update') {
    // Event update notification
    const changesText = data.changes && data.changes.length > 0 
      ? data.changes.length === 1 
        ? data.changes[0]
        : `${data.changes.slice(0, -1).join(', ')} and ${data.changes.slice(-1)}`
      : 'details';

    emailContent = {
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gencontracker.com',
      subject: `🎲 Event Update - ${data.eventTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🎲 GenCon Tracker - Event Update</h2>
          <p>Hi ${user.firstName},</p>
          <p><strong>${data.message}</strong></p>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0; color: #92400e;">Event Details:</h3>
            <p style="margin: 5px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
            <p style="margin: 5px 0;"><strong>Changes:</strong> ${changesText}</p>
          </div>
          <p>You're receiving this notification because you're tracking this event and have email notifications enabled.</p>
          <p>Check your <a href="${process.env.NEXTAUTH_URL}/schedule">schedule</a> for the latest event details.</p>
          <hr style="margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            You're receiving this because you're tracking this event and have email notifications enabled in your GenCon Tracker settings.
            <br>
            <a href="${process.env.NEXTAUTH_URL}/settings">Update your notification preferences</a>
          </p>
        </div>
      `
    };
  } else {
    // Registration reminder notification
    emailContent = {
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gencontracker.com',
      subject: `🎲 GenCon Registration Alert - ${data.timeUntilRegistration} remaining!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🎲 GenCon Tracker Alert</h2>
          <p>Hi ${user.firstName},</p>
          <p><strong>${data.message}</strong></p>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0; color: #92400e;">Registration Details:</h3>
            <p style="margin: 5px 0;"><strong>Opens:</strong> ${data.registrationDate}</p>
            <p style="margin: 5px 0;"><strong>Time Remaining:</strong> ${data.timeUntilRegistration}</p>
          </div>
          <p>Make sure you're ready with your event wishlist and payment information!</p>
          <p>Good luck securing your tickets!</p>
          <hr style="margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            You're receiving this because you have email notifications enabled in your GenCon Tracker settings.
            <br>
            <a href="${process.env.NEXTAUTH_URL}/settings">Update your notification preferences</a>
          </p>
        </div>
      `
    };
  }

  console.log('📧 EMAIL NOTIFICATION:', emailContent);
  
  // Send email with SendGrid if API key is configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      await sgMail.send(emailContent);
      console.log('✅ Email sent successfully via SendGrid');
    } catch (error) {
      console.error('❌ SendGrid email error:', error);
      throw error;
    }
  } else {
    console.log('⚠️ SendGrid API key not configured - email not sent');
  }
  
  return true;
}


export async function sendTestNotifications() {
  try {
    // Get all users with email notifications enabled
    const usersWithNotifications = await prisma.userList.findMany({
      where: {
        emailNotifications: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailNotifications: true
      }
    });

    if (usersWithNotifications.length === 0) {
      return { 
        success: false, 
        message: 'No users have notifications enabled' 
      };
    }

    const testNotificationData: NotificationData = {
      type: 'registration_reminder',
      timeUntilRegistration: 'TEST',
      registrationDate: new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      message: 'This is a test notification from GenCon Tracker! Your notification system is working correctly.'
    };

    const results = {
      emailsSent: 0,
      errors: [] as string[]
    };

    // Send test email notifications to each user
    for (const user of usersWithNotifications) {
      try {
        await sendEmailNotification(user, testNotificationData);
        results.emailsSent++;
      } catch (error) {
        console.error(`Failed to send test notification to user ${user.id}:`, error);
        results.errors.push(`Failed to notify ${user.firstName} ${user.lastName}: ${error}`);
      }
    }

    return {
      success: true,
      message: 'Test notifications sent',
      usersNotified: usersWithNotifications.length,
      ...results
    };
  } catch (error) {
    console.error('Error sending test notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkAndSendRegistrationReminders() {
  try {
    // Get the current registration timer
    const timer = await prisma.registrationTimer.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!timer) {
      return { success: false, message: 'No registration timer set' };
    }

    const result = await sendRegistrationReminders(timer.registrationDate);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Error checking registration reminders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendEventUpdateNotifications(eventId: string, eventTitle: string, changes: string[]) {
  try {
    // Get all users tracking this event with email notifications enabled
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId },
      include: {
        trackedBy: {
          where: {
            emailNotifications: true
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            emailNotifications: true
          }
        }
      }
    });

    if (!event || event.trackedBy.length === 0) {
      console.log(`No users tracking event ${eventId} with email notifications enabled`);
      return {
        success: true,
        message: 'No users to notify',
        emailsSent: 0,
        usersNotified: 0
      };
    }

    console.log(`Sending event update notifications to ${event.trackedBy.length} users tracking event ${eventId}`);

    // Format the changes message
    const changeMessage = changes.length === 1 
      ? `The ${changes[0]} has been updated`
      : changes.length === 2
      ? `The ${changes[0]} and ${changes[1]} have been updated`
      : `The ${changes.slice(0, -1).join(', ')} and ${changes.slice(-1)} have been updated`;

    const notificationData: NotificationData = {
      type: 'event_update',
      eventTitle: eventTitle,
      changes: changes,
      message: `Your tracked event "${eventTitle}" has been updated! ${changeMessage}.`
    };

    const results = {
      emailsSent: 0,
      errors: [] as string[]
    };

    // Send email notifications to each user
    for (const user of event.trackedBy) {
      try {
        await sendEmailNotification(user, notificationData);
        results.emailsSent++;
        console.log(`✅ Sent event update notification to ${user.email}`);
      } catch (error) {
        console.error(`Failed to send event update notification to ${user.email}:`, error);
        results.errors.push(`Failed to notify ${user.firstName} ${user.lastName}: ${error}`);
      }
    }

    return {
      success: true,
      message: `Event update notifications sent for "${eventTitle}"`,
      usersNotified: event.trackedBy.length,
      ...results
    };
  } catch (error) {
    console.error(`Error sending event update notifications for event ${eventId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      emailsSent: 0,
      usersNotified: 0
    };
  }
}
