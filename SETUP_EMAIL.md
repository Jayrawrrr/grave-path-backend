# Email Configuration Setup Guide

The email verification functionality is currently failing because the required environment variables are not configured. Follow these steps to set up email functionality:

## Step 1: Create Environment File

Create a `.env` file in the `backend` directory with the following content:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/graveyard_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production

# Server Configuration
PORT=5000

# Email Configuration (Gmail OAuth2)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=your_google_refresh_token_here
EMAIL_FROM=your_email@gmail.com

# Development/Testing Configuration
NODE_ENV=development
```

## Step 2: Get Gmail OAuth2 Credentials

### 2.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API" and enable it

### 2.2 Create OAuth2 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add `https://developers.google.com/oauthplayground` to authorized redirect URIs
5. Save and note down your `Client ID` and `Client Secret`

### 2.3 Get Refresh Token
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (settings) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In the left sidebar, scroll down to "Gmail API v1"
6. Select `https://www.googleapis.com/auth/gmail.send`
7. Click "Authorize APIs" and follow the prompts
8. Click "Exchange authorization code for tokens"
9. Copy the "Refresh token"

### 2.4 Update Environment Variables
Replace the placeholder values in your `.env` file:
- `GOOGLE_CLIENT_ID`: Your OAuth2 Client ID
- `GOOGLE_CLIENT_SECRET`: Your OAuth2 Client Secret  
- `GOOGLE_REFRESH_TOKEN`: The refresh token from step 2.3
- `EMAIL_FROM`: The Gmail address you want to send emails from

## Step 3: Test Configuration

You can test the email configuration using the test endpoint:

```bash
POST http://localhost:5000/api/auth/test-email-config
```

## Current Error

The 500 Internal Server Error occurs because:
1. No `.env` file exists
2. Environment variables are undefined
3. Gmail OAuth2 client fails to authenticate

## Quick Fix for Development

If you want to quickly test without setting up Gmail OAuth2, you can temporarily disable email verification by modifying the registration flow to skip email verification in development mode.

## Alternative: Use Nodemailer with SMTP

If Gmail OAuth2 setup is complex, you can modify the code to use simple SMTP:

```javascript
// Replace Gmail API with nodemailer SMTP
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD // App password, not regular password
  }
});
```

Then use app passwords instead of OAuth2 tokens.

