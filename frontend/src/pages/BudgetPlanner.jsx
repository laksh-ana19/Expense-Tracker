import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../constants';
import { formatCurrency } from '../utils/currency';
import { categoryLabel } from '../utils/categoryLabel';
import { getBudgets, saveBudget, deleteBudget } from '../api/budgets';

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function monthName(month, year, locale) {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
}

export default function BudgetPlanner() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [{ month, year }, setPeriod] = useState(currentMonthYear());
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: CATEGORIES[0], monthlyLimit: '' });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getBudgets({ month, year })
      .then(setBudgets)
      .catch((err) => setError(err.response?.data?.message || t('budgets.loadFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta) {
    setPeriod((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y += 1; }
      if (m < 1) { m = 12; y -= 1; }
      return { month: m, year: y };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const limit = Number(form.monthlyLimit);
    if (!form.category) return setError(t('budgets.categoryRequired'));
    if (Number.isNaN(limit) || limit <= 0) return setError(t('budgets.limitPositive'));

    setSaving(true);
    try {
      await saveBudget({ category: form.category, monthlyLimit: limit, month, year });
      setForm({ category: CATEGORIES[0], monthlyLimit: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('budgets.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteBudget(id);
      setConfirmId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('budgets.deleteFailed'));
    }
  }

  const budgetedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = CATEGORIES.filter((c) => !budgetedCategories.has(c));
  const currentMonthName = monthName(month, year, locale);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">{t('budgets.eyebrow')}</span>
          <h1 className="page-title">{t('budgets.title')}</h1>
          <p className="page-subtitle">{t('budgets.subtitle')}</p>
        </div>
        <div className="month-switcher">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} title={t('budgets.prevMonth')}>‹</button>
          <span className="month-switcher-label">{currentMonthName} {year}</span>
          <button className="icon-btn" onClick={() => shiftMonth(1)} title={t('budgets.nextMonth')}>›</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-card" onSubmit={handleSave} style={{ maxWidth: 'none', marginBottom: 24 }}>
        <h2>{t('budgets.setBudgetFor', { month: currentMonthName })}</h2>
        <div className="field-row">
          <label className="field">
            <span>{t('budgets.category')}</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={availableCategories.length === 0}
            >
              {(availableCategories.length ? availableCategories : CATEGORIES).map((c) => (
                <option key={c} value={c}>{categoryLabel(t, c)}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('budgets.monthlyLimit')}</span>
            <div className="amount-input-wrap">
              <span className="currency-prefix">₹</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.monthlyLimit}
                onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
                placeholder={t('budgets.amountPlaceholder')}
              />
            </div>
          </label>
        </div>
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('budgets.setBudget')}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="page-loading">{t('budgets.loadingBudgets')}</div>
      ) : budgets.length === 0 ? (
        <div className="list-card"><p className="empty-state">{t('budgets.noBudgets', { month: currentMonthName })}</p></div>
      ) : (
        <div className="budget-grid">
          {budgets.map((b) => {
            const pct = Math.min(b.percentUsed, 100);
            const over = b.percentUsed >= 100;
            const warn = !over && b.percentUsed >= 80;
            return (
              <div className="budget-card" key={b._id}>
                <div className="budget-card-header">
                  <span className="budget-category">{categoryLabel(t, b.category)}</span>
                  {confirmId === b._id ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(b._id)}>{t('common.confirm')}</button>
                      <button className="btn btn-small btn-ghost" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                    </span>
                  ) : (
                    <button className="icon-btn danger" title={t('common.delete')} onClick={() => setConfirmId(b._id)}>🗑</button>
                  )}
                </div>
                <div className="budget-amounts">
                  <span className={over ? 'budget-over-text' : ''}>{formatCurrency(b.spent, 'INR')}</span>
                  <span className="budget-of"> {t('budgets.ofLimit', { limit: formatCurrency(b.monthlyLimit, 'INR') })}</span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${over ? 'over' : warn ? 'warn' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={`budget-percent ${over ? 'budget-over-text' : warn ? 'budget-warn-text' : ''}`}>
                  {t('budgets.percentUsed', { percent: b.percentUsed })}{over ? t('budgets.overBudget') : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
