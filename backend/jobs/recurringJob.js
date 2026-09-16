const cron = require('node-cron');
const RecurringRule = require('../models/RecurringRule');
const Transaction = require('../models/Transaction');

function computeNextDue(date, frequency) {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

// Auto-creates a real transaction for every active rule whose nextDueDate has
// arrived, then advances that rule's nextDueDate. Catches up ALL missed
// occurrences for a rule in one pass (capped at MAX_CATCHUP_RUNS as a safety
// limit), not just the first one — so a server that was offline for weeks or
// months still backfills every skipped transaction instead of just one.
const MAX_CATCHUP_RUNS = 36; // e.g. 3 years of monthly, or ~8 months of weekly

async function processDueRecurringRules() {
  const now = new Date();
  const dueRules = await RecurringRule.find({ active: true, nextDueDate: { $lte: now } });

  let created = 0;

  for (const rule of dueRules) {
    let guard = 0;
    while (rule.nextDueDate <= now && guard < MAX_CATCHUP_RUNS) {
      await Transaction.create({
        userId: rule.userId,
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        date: rule.nextDueDate,
        note: rule.note ? `${rule.note} (recurring)` : 'Recurring transaction',
        currency: rule.currency,
        recurringRuleId: rule._id,
      });

      rule.nextDueDate = computeNextDue(rule.nextDueDate, rule.frequency);
      created += 1;
      guard += 1;
    }
    await rule.save();
  }

  return created;
}

// Runs once a day at midnight, and once immediately on server start so a rule
// that came due while the server was offline still gets caught up.
function startRecurringJob() {
  processDueRecurringRules().catch((err) => console.error('Recurring job (startup run) failed:', err));
  cron.schedule('0 0 * * *', () => {
    processDueRecurringRules().catch((err) => console.error('Recurring job failed:', err));
  });
}

module.exports = { startRecurringJob, processDueRecurringRules };
