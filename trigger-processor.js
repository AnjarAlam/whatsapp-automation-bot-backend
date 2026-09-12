const jwt = require('jsonwebtoken');

async function test() {
  const secret = '393b3c8e73bb25b45077089c52175c0b6c388dcf0e5af800cfb70583b0fd60ff';
  const token = jwt.sign({ sub: '6aa5585d0bcccaa3cc25c22d', email: 'alamanjar966@gmail.com' }, secret);

  const payload = {
    name: 'Direct Test Campaign',
    type: 'Offer',
    message: 'Test message {{customer_name}}',
    targetType: 'specific',
    targetCustomers: ['6aa559410bcccaa3cc25c230'],
    targetTags: []
  };

  try {
    const res = await fetch('http://localhost:5000/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('Create Response:', data);

    if (data._id) {
      const launchRes = await fetch(`http://localhost:5000/campaigns/${data._id}/launch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Launch response:', launchRes.status);
      
      // Wait for async processing
      await new Promise(r => setTimeout(r, 4000));
      
      const fs = require('fs');
      if (fs.existsSync('C:/Users/Asus/.gemini/antigravity-ide/scratch/send-error.txt')) {
        console.log('Error Log:', fs.readFileSync('C:/Users/Asus/.gemini/antigravity-ide/scratch/send-error.txt', 'utf8'));
      } else {
        console.log('No error log found, success?');
      }
    }
  } catch(e) {
    console.error(e);
  }
}
test();
