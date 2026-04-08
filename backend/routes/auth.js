const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Google OAuth Strategy
/*
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if (!user) {
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
          user.googleId = profile.id;
          await user.save();
        } else {
          user = new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            displayName: profile.displayName,
            username: profile.emails[0].value.split('@')[0],
            avatar: profile.photos[0]?.value
          });
          await user.save();
        }
      }
      
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
*/
// Register
router.post('/register', async (req, res) => {
  console.log('=== REGISTER START ===');
  console.log('Step 1: Received request body:', req.body);
  
  try {
    const { username, email, password } = req.body;
    console.log('Step 2: Extracted fields - username:', username, 'email:', email);
    
    console.log('Step 3: Checking for existing user...');
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    console.log('Step 4: Existing user check result:', existingUser ? 'FOUND' : 'NOT FOUND');
    
    if (existingUser) {
      console.log('Step 5: User already exists - returning error');
      return res.status(400).json({ message: 'User already exists' });
    }
    
    console.log('Step 6: Creating new user object...');
    const user = new User({ username, email, password });
    console.log('Step 7: User object created, attempting save...');
    
    await user.save();
    console.log('Step 8: User saved successfully to MongoDB! User ID:', user._id);
    
    console.log('Step 9: Creating JWT token...');
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('Step 10: JWT token created successfully');
    
    console.log('=== REGISTER SUCCESS ===');
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('=== REGISTER FAILED ===');
    console.error('ERROR at step:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
     console.error('REGISTER ERROR:', error);  // ADD THIS LINE
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/*// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);
*/
// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update profile
router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username or email already exists for another user
    if (username !== user.username || email !== user.email) {
      const existingUser = await User.findOne({ 
        _id: { $ne: userId },
        $or: [{ username }, { email }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
    }

    // Update basic info
    user.username = username;
    user.email = email;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      user.password = newPassword; // Will be hashed by pre-save hook
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId).select('-password');
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
