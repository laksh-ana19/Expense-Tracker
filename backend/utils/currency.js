// Static, approximate conversion rates used only to combine amounts recorded in
// different currencies into one INR-based total for dashboard/budget aggregates.
// Individual transactions always keep and display their own original currency —
// these rates are never applied to a record itself, only to totals derived from it.
// Swap this for a live FX rate provider later; the rest of the app doesn't care.
const RATES_TO_INR = {
  INR: 1,
  USD: 87,
  EUR: 94,
  GBP: 110,
};

function toINR(amount, currency) {
  const rate = RATES_TO_INR[currency] || 1;
  return amount * rate;
}

module.exports = { RATES_TO_INR, toINR };
