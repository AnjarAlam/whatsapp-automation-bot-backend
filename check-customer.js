require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI environment variable is not defined in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  
  const customerId = '6aa559410bcccaa3cc25c230';
  
  const customer = await mongoose.connection.db.collection('customers').findOne({
    _id: new mongoose.Types.ObjectId(customerId)
  });
  
  console.log('Customer:', customer);
  
  const user = await mongoose.connection.db.collection('users').findOne({
    _id: new mongoose.Types.ObjectId('6aa5585d0bcccaa3cc25c22d')
  });
  
  console.log('User:', user?.email);
  
  mongoose.disconnect();
}

test().catch(console.error);

