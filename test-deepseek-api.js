require('dotenv').config();
const axios = require('axios');

async function testDeepseekAPI() {
  try {
    console.log('Testing Deepseek API...');
    console.log('API Key:', process.env.DEEPSEEK_API_KEY ? 'Found (first 5 chars: ' + process.env.DEEPSEEK_API_KEY.substring(0, 5) + '...)' : 'Not found');
    
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a MongoDB query assistant.'
          },
          {
            role: 'user',
            content: 'Generate a MongoDB query to find all events with type "question"'
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing Deepseek API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testDeepseekAPI();
