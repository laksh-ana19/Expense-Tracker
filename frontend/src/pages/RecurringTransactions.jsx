import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../constants';
import { CURRENCIES, formatCurrency } from '../utils/currency';
import { categoryLabel } from '../utils/categoryLabel';
import { getRecurringRules, addRecurringRule, updateRecurringRule, deleteRecurringRule } from '../api/recurring';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  type: 'expense',
  category: CATEGORIES[0],
  amount: '',
  currency: 'INR',
  frequency: 'monthly',
  startDate: today(),
  note: '',
};

export default function RecurringTransactions() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getRecurringRules()
      .then(setRules)
      .catch((err) => setError(err.response?.data?.message || t('recurring.loadFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return setError(t('recurring.amountPositive'));
    if (!form.startDate) return setError(t('recurring.startDateRequired'));

    setSaving(true);
    try {
      await addRecurringRule({ ...form, amount: amountNum });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('recurring.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule) {
    try {
      await updateRecurringRule(rule._id, { active: !rule.active });
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('recurring.updateFailed'));
    }
  }

  async function handleDelete(id) {
    try {
      await deleteRecurringRule(id);
      setConfirmId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('recurring.deleteFailed'));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">{t('recurring.eyebrow')}</span>
          <h1 className="page-title">{t('recurring.title')}</h1>
          <p className="page-subtitle">{t('recurring.subtitle')}</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-card" onSubmit={handleAdd} style={{ maxWidth: 'none', marginBottom: 24 }}>
        <h2>{t('recurring.newRule')}</h2>

        <label className="field">
          <span>{t('recurring.movementLabel')}</span>
          <div className="type-toggle-pill">
            <button type="button" className={`pill-btn ${form.type === 'expense' ? 'active expense' : ''}`} onClick={() => setForm({ ...form, type: 'expense' })}>{t('recurring.expense')}</button>
            <button type="button" className={`pill-btn ${form.type === 'income' ? 'active income' : ''}`} onClick={() => setForm({ ...form, type: 'income' })}>{t('recurring.income')}</button>
          </div>
        </label>

        <div className="field-row">
          <label className="field">
            <span>{t('recurring.amount')}</span>
            <div className="amount-input-wrap">
              <span className="currency-prefix">{form.currency === 'INR' ? '₹' : ''}</span>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
          </label>
          <label className="field">
            <span>{t('recurring.currency')}</span>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{t('recurring.category')}</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('recurring.frequency')}</span>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="weekly">{t('recurring.weekly')}</option>
              <option value="monthly">{t('recurring.monthly')}</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{t('recurring.startDate')}</span>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('recurring.note')}</span>
            <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('recurring.notePlaceholder')} maxLength={300} />
          </label>
        </div>

        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('recurring.addRule')}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="page-loading">{t('recurring.loading')}</div>
      ) : rules.length === 0 ? (
        <div className="list-card"><p className="empty-state">{t('recurring.none')}</p></div>
      ) : (
        <div className="list-card">
          <div className="txn-list">
            {rules.map((r) => (
              <div className="txn-row" key={r._id}>
                <div className={`txn-icon ${r.type}`}>{r.type === 'income' ? '↙' : '↗'}</div>
                <div className="txn-main">
                  <div className="txn-title">
                    {categoryLabel(t, r.category)}
                    <span className="recurring-freq-badge">{r.frequency === 'weekly' ? t('recurring.weekly') : t('recurring.monthly')}</span>
                    {!r.active && <span className="recurring-paused-badge">{t('recurring.paused')}</span>}
                  </div>
                  <div className="txn-subtitle">
                    {r.note ? `${r.note} · ` : ''}{t('recurring.next')}: {new Date(r.nextDueDate).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className={`txn-amount ${r.type === 'income' ? 'positive' : 'negative'}`}>
                  {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount, r.currency)}
                </div>
                <div className="txn-row-actions">
                  <button className="btn btn-small btn-ghost" onClick={() => toggleActive(r)}>
                    {r.active ? t('recurring.pause') : t('recurring.resume')}
                  </button>
                  {confirmId === r._id ? (
                    <>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(r._id)}>{t('common.confirm')}</button>
                      <button className="btn btn-small btn-ghost" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                    </>
                  ) : (
                    <button className="icon-btn danger" title={t('common.delete')} onClick={() => setConfirmId(r._id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
