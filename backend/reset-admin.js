const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const ADMIN_USER = {
  username: 'owner',
  email: 'owner@miyu.com',
  password: 'admin123',
  role: 'admin'
};

async function resetUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy');
    console.log('Connected to MongoDB');

    // Delete ALL existing users
    const deleteResult = await User.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing users`);

    // Create the single admin user
    const adminUser = new User(ADMIN_USER);
    await adminUser.save();
    console.log('\n✅ Admin user created successfully!');
    console.log(`Username: ${ADMIN_USER.username}`);
    console.log(`Password: ${ADMIN_USER.password}`);
    console.log(`Email: ${ADMIN_USER.email}`);
    console.log(`Role: ${ADMIN_USER.role}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

resetUsers();
