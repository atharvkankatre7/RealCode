// Test script to directly test the code history save API
// Run with: node test-save-api.js

const API_URL = 'https://your-render-app-url.onrender.com'; // Replace with your actual Render URL

async function testSaveAPI() {
  const testData = {
    userId: 'test@example.com',
    title: 'Test Code',
    code: 'console.log("Hello, World!");',
    language: 'javascript',
    description: 'Test code for debugging',
    tags: ['test', 'debug']
  };

  console.log('🧪 Testing code history save API...');
  console.log('📍 API URL:', `${API_URL}/api/code-history/save`);
  console.log('📤 Request data:', testData);

  try {
    const response = await fetch(`${API_URL}/api/code-history/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'test@example.com'
      },
      body: JSON.stringify(testData)
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📡 Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Success! Code saved:', data);
    } else {
      console.error('❌ Error:', response.status, responseText);
      
      // Try to parse error as JSON
      try {
        const errorData = JSON.parse(responseText);
        console.error('❌ Error details:', errorData);
      } catch (e) {
        console.error('❌ Raw error response:', responseText);
      }
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Also test a simple health check
async function testHealthCheck() {
  console.log('\n🏥 Testing server health check...');
  
  try {
    const response = await fetch(`${API_URL}/api/health`);
    console.log('📡 Health check status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Server is healthy:', data);
    } else {
      console.error('❌ Server health check failed');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testHealthCheck();
  await testSaveAPI();
}

runTests().catch(console.error);