# Dotori School Node.js Email Backend

This is a simple Node.js backend for handling contact form submissions and sending emails to info@dotorischool.org using Nodemailer.

## Features
- Express.js server
- POST /contact endpoint
- Sends email to info@dotorischool.org
- Uses environment variables for SMTP credentials

## Setup
1. Copy `.env` and fill in your SMTP credentials.
2. Run `npm install` if needed.
3. Start the server:
   ```sh
   node index.js
   ```

## Environment Variables (.env)
- SMTP_HOST: Your SMTP server host
- SMTP_PORT: SMTP port (e.g., 465 for SSL)
- SMTP_SECURE: true for SSL, false for TLS
- SMTP_USER: SMTP username
- SMTP_PASS: SMTP password
- PORT: Port to run the server (default 3001)

## Example Request
POST /contact
```json
{
  "name": "Your Name",
  "email": "your@email.com",
  "message": "Hello!"
}
```

## Security
Never commit real SMTP credentials to version control.
