// Simple script to call the admin fix-index endpoint
// Replace YOUR_RENDER_URL with your actual Render backend URL

const RENDER_URL = 'https://your-render-app-url.onrender.com'; // UPDATE THIS

async function fixIndex() {
  try {
    console.log('🔧 Calling admin fix-index endpoint...');
    console.log('📍 URL:', `${RENDER_URL}/api/admin/fix-index`);
    
    const response = await fetch(`${RENDER_URL}/api/admin/fix-index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success!');
      console.log('📋 Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.error('❌ Error:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

fixIndex();