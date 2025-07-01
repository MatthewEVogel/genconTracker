import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Initialize Twilio
let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export interface NotificationData {
  type: 'registration_reminder';
  timeUntilRegistration: string;
  registrationDate: string;
  message: string;
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

  // Get all users with notifications enabled
  const usersWithNotifications = await prisma.user.findMany({
    where: {
      OR: [
        { emailNotifications: true },
        { textNotifications: true }
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      emailNotifications: true,
      textNotifications: true
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
    textsSent: 0,
    errors: [] as string[]
  };

  // Send notifications to each user
  for (const user of usersWithNotifications) {
    try {
      // Send email notification
      if (user.emailNotifications) {
        await sendEmailNotification(user, notificationData);
        results.emailsSent++;
      }

      // Send text notification
      if (user.textNotifications && user.phoneNumber) {
        await sendTextNotification(user, notificationData);
        results.textsSent++;
      }
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
  const emailContent = {
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

async function sendTextNotification(user: any, data: NotificationData) {
  const smsContent = {
    to: user.phoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: `🎲 GenCon Alert: Registration opens in ${data.timeUntilRegistration}! (${data.registrationDate}) Get ready! - GenCon Tracker`
  };

  console.log('📱 SMS NOTIFICATION:', smsContent);
  
  // Send SMS with Twilio if configured
  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const message = await twilioClient.messages.create(smsContent);
      console.log('✅ SMS sent successfully via Twilio:', message.sid);
    } catch (error) {
      console.error('❌ Twilio SMS error:', error);
      throw error;
    }
  } else {
    console.log('⚠️ Twilio not configured - SMS not sent');
  }
  
  return true;
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
