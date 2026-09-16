const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REQ-5.1: Show the user's profile (name, email)
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load profile.', error: err.message });
  }
});

// REQ-5.2: Allow updating name and/or email
router.put('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    const update = {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      update.name = name.trim();
    }
    if (email !== undefined) {
      if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email.' });
      const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.userId } });
      if (existing) return res.status(409).json({ message: 'That email is already in use.' });
      update.email = email.toLowerCase().trim();
    }

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');

    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ message: 'Profile updated.', user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That email is already in use.' });
    }
    return res.status(500).json({ message: 'Failed to update profile.', error: err.message });
  }
});

// REQ-5.3: Allow changing password (current + new password)
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to change password.', error: err.message });
  }
});

module.exports = router;
