import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTransactions, deleteTransaction, exportTransactions, getTransaction } from '../api/transactions';
import { formatCurrency } from '../utils/currency';
import { categoryLabel } from '../utils/categoryLabel';
import { openDataUrlInNewTab } from '../utils/receiptScan';

const PAGE_SIZE = 20;

export default function TransactionHistory() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // REQ-3.3
  const [sortBy, setSortBy] = useState('date'); // REQ-3.2
  const [order, setOrder] = useState('desc');
  const [confirmId, setConfirmId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState(null);
  const debounceRef = useRef(null);

  // Debounce the search box so it doesn't fire a request on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [typeFilter, sortBy, order]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { sortBy, order, page, limit: PAGE_SIZE };
    if (typeFilter !== 'all') params.type = typeFilter;
    if (search.trim()) params.search = search.trim();
    getTransactions(params)
      .then((data) => {
        setTransactions(data.transactions);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.response?.data?.message || t('transactions.loadFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, sortBy, order, search, page]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    try {
      await deleteTransaction(id);
      setConfirmId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('transactions.deleteFailed'));
    }
  }

  async function handleExport(format) {
    setExporting(true);
    setError('');
    try {
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search.trim()) params.search = search.trim();
      await exportTransactions(params, format);
    } catch (err) {
      setError(err.response?.data?.message || t('transactions.exportFailed', { format: format.toUpperCase() }));
    } finally {
      setExporting(false);
    }
  }

  async function handleViewReceipt(txId) {
    setViewingReceiptId(txId);
    try {
      const txn = await getTransaction(txId);
      if (txn.receiptImage) openDataUrlInNewTab(txn.receiptImage);
    } catch {
      // Best-effort viewer — the badge simply won't open if this fails.
    } finally {
      setViewingReceiptId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">{t('transactions.eyebrow')}</span>
          <h1 className="page-title">{t('transactions.title')}</h1>
          <p className="page-subtitle">{t('transactions.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" disabled={exporting} onClick={() => handleExport('csv')}>
            {t('transactions.exportCsv')}
          </button>
          <button className="btn btn-ghost" disabled={exporting} onClick={() => handleExport('pdf')}>
            {t('transactions.exportPdf')}
          </button>
          <Link to="/transactions/new" className="btn btn-primary">{t('common.addTransaction')}</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters-bar">
        <div className="filter-pills">
          <button className={`filter-pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>{t('transactions.all')}</button>
          <button className={`filter-pill ${typeFilter === 'income' ? 'active' : ''}`} onClick={() => setTypeFilter('income')}>{t('transactions.income')}</button>
          <button className={`filter-pill ${typeFilter === 'expense' ? 'active' : ''}`} onClick={() => setTypeFilter('expense')}>{t('transactions.expense')}</button>
        </div>

        <input
          className="search-input"
          type="text"
          placeholder={t('transactions.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <div className="sort-inline">
          <span>{t('transactions.sortBy')}</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">{t('transactions.date')}</option>
            <option value="amount">{t('transactions.amount')}</option>
            <option value="type">{t('transactions.type')}</option>
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">{t('transactions.newest')}</option>
            <option value="asc">{t('transactions.oldest')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">{t('transactions.loadingTransactions')}</div>
      ) : transactions.length === 0 ? (
        <div className="list-card">
          <p className="empty-state">
            {search ? t('transactions.noMatchSearch') : <>{t('transactions.noneFound')} <Link to="/transactions/new">{t('transactions.addOne')}</Link>.</>}
          </p>
        </div>
      ) : (
        <div className="list-card">
          <div className="txn-list">
            {transactions.map((tx) => (
              <div className="txn-row" key={tx._id}>
                <div className={`txn-icon ${tx.type}`}>{tx.type === 'income' ? '↙' : '↗'}</div>
                <div className="txn-main">
                  <div className="txn-title">
                    {categoryLabel(t, tx.category)}
                    {tx.currency && tx.currency !== 'INR' && <span className="currency-badge">{tx.currency}</span>}
                    {tx.hasReceipt && (
                      <button
                        type="button"
                        className="receipt-badge"
                        title={t('transactions.hasReceipt')}
                        disabled={viewingReceiptId === tx._id}
                        onClick={() => handleViewReceipt(tx._id)}
                      >
                        📎
                      </button>
                    )}
                  </div>
                  <div className="txn-subtitle">
                    {tx.note ? `${tx.note} · ` : ''}
                    {new Date(tx.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className={`txn-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                </div>
                <div className="txn-row-actions">
                  <Link to={`/transactions/${tx._id}/edit`} className="icon-btn" title={t('common.edit')}>✎</Link>
                  {confirmId === tx._id ? (
                    <>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(tx._id)}>{t('common.confirm')}</button>
                      <button className="btn btn-small btn-ghost" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                    </>
                  ) : (
                    <button className="icon-btn danger" title={t('common.delete')} onClick={() => setConfirmId(tx._id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <span className="pagination-info">
                {t('transactions.pageInfo', { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}
              </span>
              <div className="pagination-controls">
                <button className="btn btn-small btn-ghost" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>{t('common.prev')}</button>
                <button className="btn btn-small btn-ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
