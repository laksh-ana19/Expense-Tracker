const express = require('express');
const router = express.Router();
const RecurringRule = require('../models/RecurringRule');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /recurring — list this user's recurring rules (rent, subscriptions, etc.)
router.get('/', async (req, res) => {
  try {
    const rules = await RecurringRule.find({ userId: req.userId }).sort('-createdAt');
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recurring transactions.', error: err.message });
  }
});

// POST /recurring — create a new rule
router.post('/', async (req, res) => {
  try {
    const { type, amount, category, note, currency, frequency, startDate } = req.body;
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be income or expense.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number.' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ message: 'Category is required.' });
    }
    if (!['weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ message: 'Frequency must be weekly or monthly.' });
    }
    if (!startDate || Number.isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ message: 'A valid start date is required.' });
    }

    const rule = await RecurringRule.create({
      userId: req.userId,
      type,
      amount: Number(amount),
      category: String(category).trim(),
      note: note ? String(note).trim() : '',
      currency: currency || 'INR',
      frequency,
      startDate,
      nextDueDate: startDate, // first occurrence is the start date itself
    });
    res.status(201).json({ message: 'Recurring transaction created.', rule });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create recurring transaction.', error: err.message });
  }
});

// PUT /recurring/:id — edit fields, or pause/resume via { active: false|true }
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['type', 'amount', 'category', 'note', 'currency', 'frequency', 'startDate', 'nextDueDate', 'active'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const rule = await RecurringRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ message: 'Recurring transaction not found.' });
    res.json({ message: 'Recurring transaction updated.', rule });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update recurring transaction.', error: err.message });
  }
});

// DELETE /recurring/:id
router.delete('/:id', async (req, res) => {
  try {
    const rule = await RecurringRule.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!rule) return res.status(404).json({ message: 'Recurring transaction not found.' });
    res.json({ message: 'Recurring transaction deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete recurring transaction.', error: err.message });
  }
});

module.exports = router;
