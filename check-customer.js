const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb+srv://alamanjar966_db_user:1IRJhnhdgqZW0XNX@cluster0.cuh9ywb.mongodb.net/');
  
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
