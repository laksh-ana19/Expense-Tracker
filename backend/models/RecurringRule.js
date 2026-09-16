const mongoose = require('mongoose');

const recurringRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, required: true },
  note: { type: String, default: '' },
  currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },
  frequency: { type: String, enum: ['weekly', 'monthly'], required: true },
  startDate: { type: Date, required: true },
  nextDueDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RecurringRule', recurringRuleSchema);
