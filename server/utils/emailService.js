// server/utils/emailService.js
import nodemailer from 'nodemailer';

// Transporter instance
let transporter;

// Initialize the transporter
const initTransporter = async () => {
  // Return existing transporter if already initialized
  if (transporter) return transporter;

  // Check if we have SMTP credentials in environment variables
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // Only use mock transporter if DEV_MODE is true
  if (process.env.DEV_MODE === 'true') {
    transporter = {
      sendMail: async (options) => {
        console.log('==========================================');
        console.log('MOCK EMAIL SENT:');
        console.log('------------------------------------------');
        console.log('To:', options.to);
        console.log('From:', options.from);
        console.log('Subject:', options.subject);
        console.log('------------------------------------------');
        console.log('Text:');
        console.log(options.text);
        console.log('==========================================');
        return {
          messageId: `mock_${Date.now()}`,
          previewUrl: null,
        };
      },
    };
    return transporter;
  }

  // Create a real transporter using SMTP credentials
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Verify the connection
    await transporter.verify();

    console.log('Email transporter initialized with real SMTP credentials');
    console.log(`SMTP Server: ${smtpHost}:${smtpPort}`);

    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw new Error('SMTP connection failed. Check your SMTP credentials in .env.');
  }
};

// Send an email
const sendEmail = async (to, subject, body) => {
  try {
    // Make sure transporter is initialized
    const emailTransporter = await initTransporter();

    // Get the from address from environment variables or use default
    const fromAddress = process.env.SMTP_FROM || '"RealCode App" <noreply@realcode.app>';

    // Set email options
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${body.replace(/\n/g, '<br>')}</p>
      </div>`,
    };

    // Send the email
    const info = await emailTransporter.sendMail(mailOptions);

    // Log the result
    console.log('Email sent successfully:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      // Only include previewUrl if it exists (for mock emails in development)
      ...(info.previewUrl && { previewUrl: info.previewUrl }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const sendVerificationEmail = async (to, otp) => {
  const subject = 'Your Verification Code for RealCode';
  const text = `
    Hello,

    Your verification code for RealCode is: ${otp}

    This code will expire in 10 minutes.

    If you did not request this code, please ignore this email.

    Best regards,
    The RealCode Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-top: 0;">RealCode Verification</h2>
      <p>Hello,</p>
      <p>Your verification code for RealCode is:</p>
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 4px;">
        ${otp}
      </div>
      <p>This code will expire in <strong>10 minutes</strong>.</p>
      <p>If you did not request this code, please ignore this email.</p>
      <p>Best regards,<br>The RealCode Team</p>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  `;

  try {
    // Make sure transporter is initialized
    const emailTransporter = await initTransporter();

    // Get the from address from environment variables or use default
    const fromAddress = process.env.SMTP_FROM || '"RealCode App" <noreply@realcode.app>';

    // Set email options
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html,
    };

    // Send the email
    const info = await emailTransporter.sendMail(mailOptions);

    // Log the result
    console.log('Verification email sent successfully:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      // Only include previewUrl if it exists (for mock emails in development)
      ...(info.previewUrl && { previewUrl: info.previewUrl }),
    };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export {
  sendEmail,
  sendVerificationEmail
};
