// Mirrors backend/utils/currency.js — static, approximate rates used only to
// combine multi-currency amounts into one INR-based display figure.
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const RATES_TO_INR = { INR: 1, USD: 87, EUR: 94, GBP: 110 };

// Formats an amount in its own currency, e.g. formatCurrency(42, 'USD') -> "$42.00"
export function formatCurrency(amount, currencyCode = 'INR', options = {}) {
  const code = CURRENCIES.includes(currencyCode) ? currencyCode : 'INR';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount || 0);
}

// Compact axis labels in the Indian numbering system (k / L / Cr) for INR,
// falling back to Intl's compact notation for other currencies.
export function formatCompact(amount, currencyCode = 'INR') {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';
  const symbol = CURRENCY_SYMBOLS[currencyCode] || '₹';

  if (currencyCode === 'INR') {
    if (abs >= 1_00_00_000) return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 1)}Cr`;
    if (abs >= 1_00_000) return `${sign}${symbol}${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
    if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
    return `${sign}${symbol}${abs}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount || 0);
}

// Converts an amount from one supported currency into another using the
// static approximate table above. Used only for the dashboard's display-currency
// toggle — individual transaction records always keep their own real currency.
export function convert(amount, fromCurrency, toCurrency) {
  const fromRate = RATES_TO_INR[fromCurrency] || 1;
  const toRate = RATES_TO_INR[toCurrency] || 1;
  return (amount * fromRate) / toRate;
}

export const PREFERRED_CURRENCY_KEY = 'preferredDisplayCurrency';

export function getPreferredCurrency() {
  return localStorage.getItem(PREFERRED_CURRENCY_KEY) || 'INR';
}

export function setPreferredCurrency(code) {
  localStorage.setItem(PREFERRED_CURRENCY_KEY, code);
}
