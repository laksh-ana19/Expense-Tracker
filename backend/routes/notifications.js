const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const RecurringRule = require('../models/RecurringRule');
const authMiddleware = require('../middleware/auth');
const { RATES_TO_INR } = require('../utils/currency');

router.use(authMiddleware);

const DUE_SOON_DAYS = 7;
const ALERT_THRESHOLD_PERCENT = 80;

// GET /notifications — budget-threshold alerts + upcoming/overdue recurring bills.
// Each item has a stable `id` so the frontend can let the user dismiss it locally.
router.get('/', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [budgets, spentByCategory, dueBills] = await Promise.all([
      Budget.find({ userId, month, year }),
      Transaction.aggregate([
        { $match: { userId, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
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
      ]),
      RecurringRule.find({
        userId,
        active: true,
        nextDueDate: { $lte: new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const spentMap = Object.fromEntries(spentByCategory.map((s) => [s._id, s.spent]));

    const budgetAlerts = budgets
      .map((b) => {
        const spent = spentMap[b.category] || 0;
        const percentUsed = Math.round((spent / b.monthlyLimit) * 100);
        if (percentUsed < ALERT_THRESHOLD_PERCENT) return null;
        return {
          id: `budget:${b._id}:${year}-${month}`,
          type: 'budget',
          severity: percentUsed >= 100 ? 'over' : 'warning',
          category: b.category,
          percentUsed,
          spent,
          monthlyLimit: b.monthlyLimit,
          message:
            percentUsed >= 100
              ? `You're over budget on ${b.category} (${percentUsed}% used).`
              : `You're at ${percentUsed}% of your ${b.category} budget this month.`,
        };
      })
      .filter(Boolean);

    const billReminders = dueBills.map((r) => {
      const dueDate = new Date(r.nextDueDate);
      const overdue = dueDate < now;
      const daysUntil = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));
      return {
        id: `bill:${r._id}:${dueDate.toISOString().slice(0, 10)}`,
        type: 'bill',
        severity: overdue ? 'over' : 'warning',
        category: r.category,
        amount: r.amount,
        currency: r.currency,
        dueDate: r.nextDueDate,
        message: overdue
          ? `${r.category} (${r.frequency}) was due ${dueDate.toLocaleDateString('en-IN')}.`
          : daysUntil === 0
          ? `${r.category} (${r.frequency}) is due today.`
          : `${r.category} (${r.frequency}) is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
      };
    });

    res.json({ notifications: [...budgetAlerts, ...billReminders] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notifications.', error: err.message });
  }
});

module.exports = router;
