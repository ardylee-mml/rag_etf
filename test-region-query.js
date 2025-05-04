require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate a JWT token for testing
const generateToken = () => {
  const payload = {
    userId: 'test-user',
    username: 'tester'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Test the query endpoint with a region query
const testRegionQuery = async (region) => {
  const token = generateToken();
  const apiUrl = `http://localhost:${process.env.PORT}/api/query`;
  
  try {
    console.log(`Testing query for players from ${region} region...`);
    console.log(`API URL: ${apiUrl}`);
    
    const response = await axios.post(
      apiUrl,
      {
        query: `Find players from ${region} region`,
        collection: 'players'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Response status:', response.status);
    console.log(`Found ${response.data.results.length} players from ${region} region`);
    console.log('First 5 results:');
    console.log(JSON.stringify(response.data.results.slice(0, 5), null, 2));
  } catch (error) {
    console.error('Error testing query endpoint:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
};

// Test with different regions
const regions = ['US', 'CA', 'GB', 'JP', 'BR'];
regions.forEach(region => {
  testRegionQuery(region);
});
