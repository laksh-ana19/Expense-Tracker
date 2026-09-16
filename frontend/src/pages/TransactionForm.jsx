import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../constants';
import { categoryLabel } from '../utils/categoryLabel';
import { addTransaction, getTransaction, updateTransaction } from '../api/transactions';
import { scanReceiptAI } from '../api/receipts';
import { CURRENCIES, CURRENCY_SYMBOLS } from '../utils/currency';
import { compressImage, openDataUrlInNewTab } from '../utils/receiptScan';

const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    type: 'expense',
    category: 'Food',
    amount: '',
    date: today(),
    note: '',
    currency: 'INR',
    receiptImage: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null); // { type: 'info' | 'warn' | 'error', text }

  useEffect(() => {
    if (!isEdit) return;
    getTransaction(id)
      .then((txn) => {
        setForm({
          type: txn.type,
          category: txn.category,
          amount: String(txn.amount),
          date: txn.date.slice(0, 10),
          note: txn.note || '',
          currency: txn.currency || 'INR',
          receiptImage: txn.receiptImage || '',
        });
      })
      .catch((err) => setError(err.response?.data?.message || t('form.loadFailed')))
      .finally(() => setLoadingInitial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleReceiptSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setScanMessage(null);
    setScanning(true);
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, receiptImage: dataUrl }));

      const result = await scanReceiptAI(dataUrl);
      setForm((f) => ({
        ...f,
        amount: result.amount != null ? String(result.amount) : f.amount,
        date: result.date || f.date,
        category: result.category || f.category,
        note: f.note || result.note || '',
      }));

      if (result.amount == null) {
        setScanMessage({ type: 'warn', text: t('form.receiptNoAmount') });
      } else {
        setScanMessage({ type: 'info', text: t('form.receiptDetected') });
      }
    } catch (err) {
      setScanMessage({ type: 'error', text: err.response?.data?.message || t('form.receiptFailed') });
    } finally {
      setScanning(false);
    }
  }

  function removeReceipt() {
    setForm((f) => ({ ...f, receiptImage: '' }));
    setScanMessage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return setError(t('form.amountPositive')); // REQ-2.2
    }
    if (!form.category) return setError(t('form.categoryRequired'));
    if (!form.date) return setError(t('form.dateRequired'));

    setLoading(true);
    try {
      const payload = { ...form, amount: amountNum };
      if (isEdit) {
        await updateTransaction(id, payload);
      } else {
        await addTransaction(payload);
      }
      navigate('/transactions');
    } catch (err) {
      setError(err.response?.data?.message || t('form.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (loadingInitial) return <div className="page-loading">{t('form.loadingTransaction')}</div>;

  return (
    <div className="page page-narrow">
      <div className="page-header-text" style={{ marginBottom: 22 }}>
        <span className="eyebrow">{t('form.eyebrow')}</span>
        <h1 className="page-title">{isEdit ? t('form.editTitle') : t('form.addTitle')}</h1>
        <p className="page-subtitle">{t('form.subtitle')}</p>
      </div>

      <form className="card form-card" onSubmit={handleSubmit} noValidate style={{ maxWidth: 'none' }}>
        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>{t('form.receiptLabel')}</span>
          <p className="field-hint">{t('form.receiptHint')}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleReceiptSelected}
          />

          <div className="receipt-upload-row">
            {form.receiptImage && (
              <button
                type="button"
                className="receipt-thumb"
                onClick={() => openDataUrlInNewTab(form.receiptImage)}
                title={t('transactions.hasReceipt')}
              >
                <img src={form.receiptImage} alt="" />
              </button>
            )}
            <div className="receipt-upload-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={scanning}
                onClick={() => fileInputRef.current?.click()}
              >
                {scanning ? t('form.receiptScanning') : form.receiptImage ? t('form.receiptRescan') : t('form.receiptScanButton')}
              </button>
              {form.receiptImage && !scanning && (
                <button type="button" className="link-cancel" onClick={removeReceipt}>
                  {t('form.receiptRemove')}
                </button>
              )}
            </div>
          </div>

          {scanMessage && (
            <div className={`alert alert-${scanMessage.type === 'error' ? 'error' : scanMessage.type === 'warn' ? 'warn' : 'success'}`} style={{ marginTop: 10 }}>
              {scanMessage.text}
            </div>
          )}
        </label>

        <label className="field">
          <span>{t('form.movementLabel')}</span>
          <div className="type-toggle-pill">
            <button
              type="button"
              className={`pill-btn ${form.type === 'expense' ? 'active expense' : ''}`}
              onClick={() => setForm({ ...form, type: 'expense' })}
            >
              {t('form.iSpent')}
            </button>
            <button
              type="button"
              className={`pill-btn ${form.type === 'income' ? 'active income' : ''}`}
              onClick={() => setForm({ ...form, type: 'income' })}
            >
              {t('form.iReceived')}
            </button>
          </div>
        </label>

        <div className="field-row">
          <label className="field">
            <span>{t('form.amount')}</span>
            <div className="amount-input-wrap">
              <span className="currency-prefix">{CURRENCY_SYMBOLS[form.currency] || '₹'}</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
          </label>

          <label className="field">
            <span>{t('form.currency')}</span>
            <select name="currency" value={form.currency} onChange={handleChange}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{t('form.date')}</span>
            <input name="date" type="date" value={form.date} onChange={handleChange} max={today()} />
          </label>

          <label className="field">
            <span>{t('form.category')}</span>
            <select name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>{t('form.note')}</span>
            <input name="note" type="text" value={form.note} onChange={handleChange} placeholder={t('form.notePlaceholder')} maxLength={300} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="link-cancel" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.saving') : t('form.saveTransaction')}
          </button>
        </div>
      </form>
    </div>
  );
}
