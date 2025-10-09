// Test script to reproduce the language override issue
const fetch = require('node-fetch'); // You'll need to install this if not available

const API_URL = 'http://localhost:5002';

const testSaveCode = async () => {
  try {
    const response = await fetch(`${API_URL}/api/code-history/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'test@example.com'
      },
      body: JSON.stringify({
        userId: 'test@example.com',
        title: 'Test Code',
        code: 'console.log("Hello World");',
        language: 'javascript',
        description: 'Test description',
        tags: ['test']
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success:', data);
    } else {
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

testSaveCode();