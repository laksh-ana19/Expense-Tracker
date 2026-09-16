const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const { RATES_TO_INR } = require('../utils/currency');

const router = express.Router();
router.use(authMiddleware);

// Converts each transaction's amount to INR (its native currency) before any
// $group stage, so totals stay meaningful across multi-currency records.
const addAmountInr = {
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
};

// REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4: balance, expenses-by-category, income-vs-expense trend
router.get('/summary', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    // Totals -> current balance (REQ-4.1), converted to INR for a single figure
    const totals = await Transaction.aggregate([
      { $match: { userId } },
      addAmountInr,
      { $group: { _id: '$type', total: { $sum: '$amountInr' } } },
    ]);
    const totalIncome = totals.find((t) => t._id === 'income')?.total || 0;
    const totalExpense = totals.find((t) => t._id === 'expense')?.total || 0;
    const balance = totalIncome - totalExpense;

    // Expenses by category (REQ-4.2)
    const byCategory = await Transaction.aggregate([
      { $match: { userId, type: 'expense' } },
      addAmountInr,
      { $group: { _id: '$category', total: { $sum: '$amountInr' } } },
      { $sort: { total: -1 } },
    ]);

    // Income vs expense trend over time, grouped by month (REQ-4.3)
    const trend = await Transaction.aggregate([
      { $match: { userId } },
      addAmountInr,
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amountInr' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const trendMap = {};
    trend.forEach((t) => {
      const key = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
      if (!trendMap[key]) trendMap[key] = { month: key, income: 0, expense: 0 };
      trendMap[key][t._id.type] = t.total;
    });
    const trendSeries = Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month));

    // Recent transactions for the dashboard card (kept in their own currency)
    const recent = await Transaction.find({ userId }).sort({ date: -1, _id: -1 }).limit(5);
    const transactionCount = await Transaction.countDocuments({ userId });

    return res.json({
      balance,
      totalIncome,
      totalExpense,
      baseCurrency: 'INR',
      expensesByCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
      trend: trendSeries,
      recentTransactions: recent,
      transactionCount,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load dashboard summary.', error: err.message });
  }
});

module.exports = router;
