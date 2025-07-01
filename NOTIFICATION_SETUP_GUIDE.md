# 📧📱 Notification Setup Guide - SendGrid & Twilio Integration

This guide will walk you through setting up SendGrid (email) and Twilio (SMS) for your GenCon Tracker notifications.

## 🚀 Quick Overview

Your notification system is now ready to send real emails and SMS messages! You just need to:
1. Create accounts with SendGrid and Twilio
2. Get your API keys
3. Update your `.env` file
4. Test the system

---

## 📧 SendGrid Setup (Email Notifications)

### Step 1: Create SendGrid Account
1. Go to [https://sendgrid.com/](https://sendgrid.com/)
2. Click "Start for Free"
3. Sign up with your email
4. Verify your email address

### Step 2: Get API Key
1. Log into SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **"Create API Key"**
4. Choose **"Restricted Access"**
5. Give it a name like "GenCon Tracker"
6. Under **Mail Send**, select **"Full Access"**
7. Click **"Create & View"**
8. **Copy the API key** (you won't see it again!)

### Step 3: Verify Sender Email
1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"** // 
3. Fill out the form with your email (this will be the "from" address)
4. Check your email and click the verification link

### Step 4: Update .env File
Replace `your_sendgrid_api_key_here` with your actual API key:
```
SENDGRID_API_KEY="SG.your_actual_api_key_here"
SENDGRID_FROM_EMAIL="your_verified_email@domain.com"
```

---

## 📱 Twilio Setup (SMS Notifications)

### Step 1: Create Twilio Account
1. Go to [https://www.twilio.com/](https://www.twilio.com/)
2. Click "Sign up and start building"
3. Sign up with your email and phone number
4. Verify your phone number

### Step 2: Get Account Credentials
1. In your Twilio Console dashboard
2. Find your **Account SID** and **Auth Token** in the "Account Info" section
3. Copy both values

### Step 3: Get a Phone Number
1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Choose a number (US numbers work best for US recipients)
3. Purchase the number (usually $1/month)
4. Copy the phone number (format: +1234567890)

### Step 4: Update .env File
Replace the Twilio placeholders with your actual values:
```
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"
```

---

## 🔧 Final Configuration

Your complete `.env` file should look like this:

```env
DATABASE_URL="file:./dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET="44tYkMm+gR/XavfbleQG7GDehBN81JHY9ceDpyuSXW4="
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth Configuration
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"

# SendGrid Configuration (for email notifications)
SENDGRID_API_KEY="SG.your_actual_sendgrid_api_key_here"
SENDGRID_FROM_EMAIL="your_verified_email@domain.com"

# Twilio Configuration (for SMS notifications)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_actual_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"
```

---

## 🧪 Testing Your Setup

### Test Email Notifications
1. Make sure you have email notifications enabled in your user settings
2. Go to the Admin panel
3. Click "Test Notifications"
4. Check your email inbox

### Test SMS Notifications
1. Make sure you have SMS notifications enabled and a phone number in your settings
2. Go to the Admin panel
3. Click "Test Notifications"
4. Check your phone for the SMS

---

## 💰 Pricing Information

### SendGrid
- **Free Tier**: 100 emails/day forever
- **Paid Plans**: Start at $19.95/month for 40,000 emails

### Twilio
- **SMS**: ~$0.0075 per message in the US
- **Phone Number**: ~$1/month
- **No monthly minimums**

---

## 🔍 Troubleshooting

### Email Not Sending?
- Check that your SendGrid API key is correct
- Verify your sender email is verified in SendGrid
- Check the server console for error messages

### SMS Not Sending?
- Verify your Twilio credentials are correct
- Make sure your phone number includes the country code (+1 for US)
- Check that you have sufficient Twilio balance

### Still Having Issues?
- Check the browser console and server terminal for error messages
- Verify all environment variables are set correctly
- Restart your development server after updating .env

---

## 🎉 You're All Set!

Once configured, your GenCon Tracker will automatically send:
- **1 day before** registration opens
- **6 hours before** registration opens  
- **30 minutes before** registration opens

Users can control their notification preferences in the Settings page.

**Happy tracking! 🎲**
