const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Get all writers (admin, pharmacist, manager only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!['admin', 'pharmacist', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // For writers management, include plainPassword for admin users to see
    const writers = await User.find({ role: 'writer' }).select('username email role createdAt plainPassword');
    res.json(writers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new writer (admin, pharmacist, manager only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!['admin', 'pharmacist', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { username, email, password } = req.body;

    // Auto-generate email if not provided
    const writerEmail = email || `${username.toLowerCase().replace(/\s+/g, '.')}@miyu.com`;

    // Check if writer already exists
    const existingWriter = await User.findOne({ 
      $or: [{ username }, { email: writerEmail }] 
    });

    if (existingWriter) {
      return res.status(400).json({ message: 'Writer with this username already exists' });
    }

    // Create new writer with parentAdmin link
    const writer = new User({
      username,
      email: writerEmail,
      password,
      role: 'writer',
      parentAdmin: req.user.userId // Link to the admin who created this writer
    });

    await writer.save();

    res.status(201).json({
      message: 'Writer created successfully',
      writer: {
        id: writer._id,
        username: writer.username,
        email: writer.email,
        role: writer.role,
        plainPassword: writer.plainPassword // Include plain password for admin to see
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update writer (admin, pharmacist, manager only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!['admin', 'pharmacist', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { username, email, password } = req.body;
    const writerId = req.params.id;

    // Find and update writer
    const writer = await User.findById(writerId);
    if (!writer || writer.role !== 'writer') {
      return res.status(404).json({ message: 'Writer not found' });
    }

    // Update fields
    if (username) writer.username = username;
    if (email) writer.email = email;
    if (password) writer.password = password; // Will be hashed by pre-save hook

    await writer.save();

    res.json({
      message: 'Writer updated successfully',
      writer: {
        id: writer._id,
        username: writer.username,
        email: writer.email,
        role: writer.role,
        plainPassword: writer.plainPassword
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete writer (admin, pharmacist, manager only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!['admin', 'pharmacist', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const writerId = req.params.id;

    // Find and delete writer
    const writer = await User.findById(writerId);
    if (!writer || writer.role !== 'writer') {
      return res.status(404).json({ message: 'Writer not found' });
    }

    await User.findByIdAndDelete(writerId);

    res.json({ message: 'Writer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
