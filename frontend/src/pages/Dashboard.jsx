import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { getSummary } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';
import { CURRENCIES, formatCurrency, formatCompact, convert, getPreferredCurrency, setPreferredCurrency } from '../utils/currency';
import { categoryLabel } from '../utils/categoryLabel';

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend);

// Validated categorical palette (dataviz skill, light mode) — fixed hue order, never cycled.
const CATEGORY_COLORS = [
  '#eb6834', '#1baf7a', '#eda100', '#4a3aa7',
  '#e87ba4', '#2a78d6', '#008300', '#e34948',
];
const INCOME_COLOR = '#1baf7a';
const EXPENSE_COLOR = '#eb6834';
const INK_SECONDARY = '#6b6455';
const GRIDLINE = '#eae3d2';

// Draws the total in the center of the doughnut chart.
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart) {
    if (chart.config.type !== 'doughnut' || !chart.config.options.plugins?.centerText) return;
    const { ctx, chartArea } = chart;
    const { total, currency, label } = chart.config.options.plugins.centerText;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9a9282';
    ctx.font = '600 9.5px Inter, sans-serif';
    ctx.fillText(label, cx, cy - 12);
    ctx.fillStyle = '#201d16';
    ctx.font = '700 15px Inter, sans-serif';
    ctx.fillText(formatCurrency(total, currency, { maximumFractionDigits: 0 }), cx, cy + 6);
    ctx.restore();
  },
};
ChartJS.register(centerTextPlugin);

function monthLabel(key, locale) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, { month: 'short' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState(getPreferredCurrency());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSummary()
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || t('dashboard.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCurrencyChange(code) {
    setDisplayCurrency(code);
    setPreferredCurrency(code);
  }

  // The backend always returns figures pre-converted to INR (summary.baseCurrency).
  // Everything below is converted once, at render time, into whatever the user picked.
  const c = (amount) => convert(amount, summary?.baseCurrency || 'INR', displayCurrency);

  const trend = useMemo(
    () => (summary?.trend || []).map((tr) => ({ ...tr, income: c(tr.income), expense: c(tr.expense) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary, displayCurrency]
  );
  const expensesByCategory = useMemo(
    () => (summary?.expensesByCategory || []).map((cat) => ({ ...cat, total: c(cat.total) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary, displayCurrency]
  );

  if (loading) return <div className="page-loading">{t('dashboard.loadingDashboard')}</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!summary) return null;

  const balance = c(summary.balance);
  const { recentTransactions, transactionCount } = summary;
  const latest = trend[trend.length - 1] || { income: 0, expense: 0 };
  const totalExpense = expensesByCategory.reduce((s, cat) => s + cat.total, 0);

  const lineData = {
    labels: trend.map((tr) => monthLabel(tr.month, locale)),
    datasets: [
      {
        label: t('dashboard.in'),
        data: trend.map((tr) => tr.income || 0),
        borderColor: INCOME_COLOR,
        backgroundColor: 'rgba(27,175,122,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: t('dashboard.out'),
        data: trend.map((tr) => tr.expense || 0),
        borderColor: EXPENSE_COLOR,
        backgroundColor: 'rgba(235,104,52,0.06)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: INK_SECONDARY, usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, displayCurrency)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: INK_SECONDARY, font: { size: 11 } } },
      y: { grid: { color: GRIDLINE }, ticks: { color: INK_SECONDARY, font: { size: 11 }, callback: (v) => formatCompact(v, displayCurrency) } },
    },
  };

  const doughnutData = {
    labels: expensesByCategory.map((cat) => categoryLabel(t, cat.category)),
    datasets: [{
      data: expensesByCategory.map((cat) => cat.total),
      backgroundColor: expensesByCategory.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
      borderColor: '#fff',
      borderWidth: 3,
      cutout: '72%',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      centerText: { total: totalExpense, currency: displayCurrency, label: t('dashboard.total') },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed, displayCurrency)}` } },
    },
  };

  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">{t('dashboard.goodDay', { name: firstName })}</span>
          <h1 className="page-title">{t('dashboard.heroTitle')}</h1>
          <p className="page-subtitle">{t('dashboard.heroSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="currency-toggle"
            value={displayCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            title={t('dashboard.currencyTitle')}
          >
            {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <Link to="/transactions/new" className="btn btn-primary">{t('common.addTransaction')}</Link>
        </div>
      </div>

      <div className="overview-top">
        <div className="hero-balance-card">
          <div>
            <span className="hero-eyebrow">{t('dashboard.availableBalance')}</span>
            <div className="hero-value">{formatCurrency(balance, displayCurrency)}</div>
          </div>
          <div className="hero-note">{t('dashboard.updatedNote')}</div>
        </div>

        <div className="mini-stat-card">
          <div className="mini-stat-header">
            <span className="eyebrow">{t('dashboard.thisView')}</span>
          </div>
          <div className="mini-stat-row">
            <div className="mini-stat-col">
              <span className="mini-stat-label">{t('dashboard.income')}</span>
              <span className="mini-stat-value" style={{ color: 'var(--income)' }}>{formatCurrency(latest.income, displayCurrency)}</span>
            </div>
            <div className="mini-stat-col">
              <span className="mini-stat-label">{t('dashboard.spent')}</span>
              <span className="mini-stat-value" style={{ color: 'var(--expense)' }}>{formatCurrency(latest.expense, displayCurrency)}</span>
            </div>
          </div>
          <div className="mini-stat-footer">
            <span>{t('dashboard.recordsKept')}</span>
            <strong>{transactionCount ?? recentTransactions.length}</strong>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <span className="eyebrow">{t('dashboard.cashFlow')}</span>
          </div>
          {trend.length === 0 ? (
            <p className="empty-state">{t('dashboard.addTransactionsHint')}</p>
          ) : (
            <div style={{ height: 220 }}><Line data={lineData} options={lineOptions} /></div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <span className="eyebrow">{t('dashboard.whereItGoes')}</span>
            <h2>{t('dashboard.spendingMix')}</h2>
          </div>
          {expensesByCategory.length === 0 ? (
            <p className="empty-state">{t('dashboard.noExpenses')}</p>
          ) : (
            <div className="donut-wrap">
              <div className="donut-canvas-wrap">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div className="legend-list">
                {expensesByCategory.slice(0, 6).map((cat, i) => (
                  <div className="legend-row" key={cat.category}>
                    <span className="legend-dot" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="legend-label">{categoryLabel(t, cat.category)}</span>
                    <span className="legend-amount">{formatCurrency(cat.total, displayCurrency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="recent-card">
        <div className="recent-header">
          <span className="eyebrow">{t('dashboard.latestNotes')}</span>
        </div>
        <div className="recent-header" style={{ marginBottom: 6 }}>
          <h2>{t('dashboard.recentTransactions')}</h2>
          <Link to="/transactions">{t('common.viewAll')}</Link>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="empty-state">{t('dashboard.noTransactionsYet')}</p>
        ) : (
          <div className="txn-list">
            {recentTransactions.map((tItem) => (
              <div className="txn-row" key={tItem._id}>
                <div className={`txn-icon ${tItem.type}`}>{tItem.type === 'income' ? '↙' : '↗'}</div>
                <div className="txn-main">
                  <div className="txn-title">
                    {categoryLabel(t, tItem.category)}
                    {tItem.currency && tItem.currency !== 'INR' && <span className="currency-badge">{tItem.currency}</span>}
                  </div>
                  <div className="txn-subtitle">{tItem.note ? `${tItem.note} · ` : ''}{new Date(tItem.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className={`txn-amount ${tItem.type === 'income' ? 'positive' : 'negative'}`}>
                  {tItem.type === 'income' ? '+' : '-'}{formatCurrency(tItem.amount, tItem.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
