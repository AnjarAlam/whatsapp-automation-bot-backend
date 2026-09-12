async function test() {
  try {
    // 1. login to get token
    let loginRes = await fetch('http://localhost:5000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' })
    });
    
    let loginData = await loginRes.json();
    
    if (!loginRes.ok) {
      loginRes = await fetch('http://localhost:5000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test User',
          businessName: 'Test Business',
          email: 'test@test.com',
          mobile: '1234567890',
          password: 'password123'
        })
      });
      loginData = await loginRes.json();
    }

    const token = loginData.tokens.accessToken;
    console.log('Got token');

    // 2. Create campaign
    const payload = {
      name: 'Test Campaign',
      type: 'Offer',
      message: 'Test message',
      targetType: 'all',
      targetCustomers: [],
      targetTags: []
    };

    const campRes = await fetch('http://localhost:5000/campaigns', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload)
    });

    const campData = await campRes.json();
    console.log('Campaign created:', campRes.status, campData);

    if (!campRes.ok) return;

    // 3. Launch campaign
    const launchRes = await fetch(`http://localhost:5000/campaigns/${campData._id}/launch`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    });

    const launchData = await launchRes.json();
    console.log('Campaign launched:', launchRes.status, launchData);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
