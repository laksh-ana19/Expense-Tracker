const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const { RATES_TO_INR } = require('../utils/currency');

router.use(authMiddleware);

// GET /budgets?month=&year=  — list budgets + spent-so-far per category (converted to INR)
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const userId = new mongoose.Types.ObjectId(req.userId);

    const budgets = await Budget.find({ userId, month, year }).sort('category');

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const spentByCategory = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $addFields: {
          amountInr: {
            $multiply: [
              '$amount',
              {
                $switch: {
                  branches: Object.entries(RATES_TO_INR).map(([code, rate]) => ({
                    case: { $eq: ['$currency', code] },
                    then: rate,
                  })),
                  default: 1,
                },
              },
            ],
          },
        },
      },
      { $group: { _id: '$category', spent: { $sum: '$amountInr' } } },
    ]);

    const spentMap = Object.fromEntries(spentByCategory.map((s) => [s._id, s.spent]));

    const result = budgets.map((b) => {
      const spent = spentMap[b.category] || 0;
      return {
        ...b.toObject(),
        spent,
        percentUsed: Math.round((spent / b.monthlyLimit) * 100),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch budgets.', error: err.message });
  }
});

// POST /budgets — create or update the limit for a category/month (upsert)
router.post('/', async (req, res) => {
  try {
    const { category, monthlyLimit } = req.body;
    const now = new Date();
    const month = parseInt(req.body.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.body.year, 10) || now.getFullYear();

    if (!category || !monthlyLimit || Number(monthlyLimit) <= 0) {
      return res.status(400).json({ message: 'category and a positive monthlyLimit are required.' });
    }

    const budget = await Budget.findOneAndUpdate(
      { userId: req.userId, category: String(category).trim(), month, year },
      { $set: { monthlyLimit: Number(monthlyLimit) } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ message: 'Budget saved.', budget });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A budget for that category and month already exists.' });
    }
    res.status(500).json({ message: 'Failed to save budget.', error: err.message });
  }
});

// DELETE /budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });
    res.json({ message: 'Budget deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete budget.', error: err.message });
  }
});

module.exports = router;
