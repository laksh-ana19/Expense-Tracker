const cron = require('node-cron');
const RecurringRule = require('../models/RecurringRule');
const Transaction = require('../models/Transaction');

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the occurrence after `date`. Monthly rules stay anchored to the start
// date's day of the month (clamped for shorter months), so a rule starting on
// the 31st goes 31 Jan -> 28 Feb -> 31 Mar instead of drifting to the 3rd.
function computeNextDue(date, frequency, anchorDay) {
  const d = new Date(date);
  if (frequency === 'weekly') return new Date(d.getTime() + 7 * DAY_MS);

  const day = anchorDay || d.getUTCDate();
  const year = d.getUTCFullYear();
  const nextMonth = d.getUTCMonth() + 1;
  const lastDayOfNextMonth = new Date(Date.UTC(year, nextMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year, nextMonth, Math.min(day, lastDayOfNextMonth),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()
  ));
}

// Safety limit per run: e.g. 3 years of monthly, or ~8 months of weekly.
// Anything older is picked up by the next run.
const MAX_CATCHUP_RUNS = 36;

// Creates a real transaction for every occurrence of ONE rule that is due
// (nextDueDate <= now), oldest first, and moves nextDueDate past today.
// Each occurrence is "claimed" atomically before its transaction is created,
// so the daily job and an API request running at the same moment can never
// create the same transaction twice.
async function catchUpRule(ruleId, now = new Date()) {
  let created = 0;

  for (let i = 0; i < MAX_CATCHUP_RUNS; i += 1) {
    const rule = await RecurringRule.findOne({ _id: ruleId, active: true, nextDueDate: { $lte: now } });
    if (!rule) break; // nothing (more) due

    const dueDate = rule.nextDueDate;
    const nextDue = computeNextDue(dueDate, rule.frequency, new Date(rule.startDate).getUTCDate());

    const claimed = await RecurringRule.findOneAndUpdate(
      { _id: rule._id, nextDueDate: dueDate, active: true },
      { $set: { nextDueDate: nextDue } }
    );
    if (!claimed) continue; // another run just handled this occurrence

    try {
      await Transaction.create({
        userId: rule.userId,
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        date: dueDate,
        note: rule.note ? `${rule.note} (recurring)` : 'Recurring transaction',
        currency: rule.currency,
        recurringRuleId: rule._id,
      });
    } catch (err) {
      // Put the due date back so this occurrence is retried next time.
      await RecurringRule.updateOne({ _id: rule._id, nextDueDate: nextDue }, { $set: { nextDueDate: dueDate } });
      throw err;
    }
    created += 1;
  }

  return created;
}

// Catches up every active rule that is due, for all users.
async function processDueRecurringRules() {
  const now = new Date();
  const dueRules = await RecurringRule.find({ active: true, nextDueDate: { $lte: now } }).select('_id');

  let created = 0;
  for (const { _id } of dueRules) {
    created += await catchUpRule(_id, now);
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

module.exports = { startRecurringJob, processDueRecurringRules, catchUpRule, computeNextDue };