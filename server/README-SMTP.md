# SMTP Configuration for RealCode

To enable real OTP email delivery, update the following in your `server/.env` file:

- SMTP_HOST: Your SMTP server (e.g., smtp.gmail.com, smtp.sendgrid.net)
- SMTP_PORT: Usually 587
- SMTP_SECURE: false (for most providers)
- SMTP_USER: Your SMTP username (email or 'apikey' for SendGrid)
- SMTP_PASS: Your SMTP password or API key
- SMTP_FROM: The sender name and email (e.g., RealCode <your@email.com>)
- DEV_MODE: Set to false to use real SMTP

Example for Gmail:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=RealCode <your-email@gmail.com>
DEV_MODE=false

After updating `.env`, restart your backend server for changes to take effect.

If you see SMTP errors in the backend logs, double-check your credentials and provider settings.

---

_Last updated: May 19, 2025_

## Setting Up SMTP Credentials

To enable real email sending for OTP verification, you need to configure SMTP credentials in the `.env` file.

### Step 1: Choose an Email Provider

You can use any of the following email providers:

1. **Gmail**
2. **SendGrid**
3. **Mailgun**
4. **Zoho Mail**
5. **Amazon SES**
6. Or any other SMTP provider

### Step 2: Update the .env File

Open the `.env` file in the server directory and update the following variables:

```
SMTP_HOST=your-smtp-host
SMTP_PORT=your-smtp-port
SMTP_SECURE=true-or-false
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=Your Name <your-email@example.com>
DEV_MODE=false
```

### Step 3: Provider-Specific Instructions

#### Gmail

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=RealCode <your-gmail-address@gmail.com>
```

**Important Note for Gmail:**
- If you have 2-Factor Authentication enabled, you need to create an App Password.
- Go to [Google Account Security](https://myaccount.google.com/security) > App Passwords
- Select "Mail" and "Other (Custom name)" and enter "RealCode"
- Use the generated 16-character password as your SMTP_PASS

#### SendGrid

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=RealCode <your-verified-sender@example.com>
```

**Note:** You need to verify your sender email in SendGrid before using it.

#### Mailgun

```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=RealCode <your-verified-sender@your-domain.com>
```

### Step 4: Restart the Server

After updating the `.env` file, restart the server to apply the changes:

```
npm run dev
```

## Troubleshooting

If you encounter issues with email sending:

1. **Check Logs**: Look for error messages in the server console
2. **Verify Credentials**: Make sure your username and password are correct
3. **Check Provider Settings**: Some providers may require additional settings
4. **Test Connection**: Use a tool like [Nodemailer SMTP Tester](https://nodemailer.com/smtp/testing/) to test your SMTP connection

## Security Considerations

- Never commit your SMTP credentials to version control
- Consider using environment variables in production
- Rotate your passwords/API keys periodically
- Use secure connections when possible

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP API](https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp)
- [Mailgun SMTP](https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp)
