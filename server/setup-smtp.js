// server/setup-smtp.js
import fs from 'fs';
import readline from 'readline';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load existing environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Function to test SMTP connection
const testSMTPConnection = async (config) => {
  try {
    console.log('\nTesting SMTP connection...');
    
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: config.secure === 'true',
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
};

// Function to update .env file
const updateEnvFile = (config) => {
  try {
    // Read the current .env file
    const envPath = './.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update SMTP settings
    envContent = envContent.replace(/SMTP_HOST=.*/, `SMTP_HOST=${config.host}`);
    envContent = envContent.replace(/SMTP_PORT=.*/, `SMTP_PORT=${config.port}`);
    envContent = envContent.replace(/SMTP_SECURE=.*/, `SMTP_SECURE=${config.secure}`);
    envContent = envContent.replace(/SMTP_USER=.*/, `SMTP_USER=${config.user}`);
    envContent = envContent.replace(/SMTP_PASS=.*/, `SMTP_PASS=${config.pass}`);
    envContent = envContent.replace(/SMTP_FROM=.*/, `SMTP_FROM=${config.from}`);
    envContent = envContent.replace(/DEV_MODE=.*/, 'DEV_MODE=false');
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ .env file updated successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    return false;
  }
};

// Main function
const main = async () => {
  console.log('=== SMTP Configuration Setup ===');
  console.log('This script will help you configure SMTP settings for sending emails.');
  console.log('You can use Gmail, SendGrid, or any other SMTP provider.');
  console.log('\nCurrent SMTP settings:');
  console.log(`Host: ${process.env.SMTP_HOST || 'Not set'}`);
  console.log(`Port: ${process.env.SMTP_PORT || 'Not set'}`);
  console.log(`Secure: ${process.env.SMTP_SECURE || 'Not set'}`);
  console.log(`User: ${process.env.SMTP_USER || 'Not set'}`);
  console.log(`From: ${process.env.SMTP_FROM || 'Not set'}`);
  
  console.log('\nPlease enter your SMTP settings:');
  
  // Get SMTP settings from user
  const config = {
    host: await prompt(`SMTP Host (e.g., smtp.gmail.com): `),
    port: await prompt(`SMTP Port (e.g., 587 for Gmail): `),
    secure: await prompt(`Secure connection (true/false, usually false for port 587): `),
    user: await prompt(`SMTP Username (your email address): `),
    pass: await prompt(`SMTP Password (for Gmail, use App Password if 2FA is enabled): `),
    from: await prompt(`From address (e.g., "RealCode <your-email@example.com>"): `)
  };
  
  // Test SMTP connection
  const connectionSuccess = await testSMTPConnection(config);
  
  if (connectionSuccess) {
    // Update .env file
    const updateSuccess = updateEnvFile(config);
    
    if (updateSuccess) {
      console.log('\n✅ SMTP configuration completed successfully!');
      console.log('You can now restart the server to apply the changes.');
    } else {
      console.log('\n❌ SMTP configuration failed. Please try again.');
    }
  } else {
    console.log('\n❌ SMTP connection test failed. Please check your settings and try again.');
  }
  
  rl.close();
};

// Run the main function
main().catch(error => {
  console.error('An error occurred:', error);
  rl.close();
});
