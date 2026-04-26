const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  plainPassword: {
    type: String
  },
  googleId: {
    type: String,
    sparse: true
  },
  displayName: {
    type: String
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['admin', 'pharmacist', 'manager', 'writer'],
    default: 'pharmacist'
  },
  parentAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', function() {
  // Only run this function if password was modified (or new)
  if (!this.isModified('password')) return;
  
  // Skip if password is not set (for Google OAuth users)
  if (!this.password) return;

  // Store plain password for writers so admin can see it
  if (this.role === 'writer') {
    this.plainPassword = this.password;
  }

  // Hash the password with cost of 10
  this.password = bcrypt.hashSync(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
