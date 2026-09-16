import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import NotificationsBell from './NotificationsBell';
import LanguageSwitcher from './LanguageSwitcher';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

export default function Sidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  if (!isAuthenticated) return null;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
        {open ? '✕' : '☰'}
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🧾</div>
          <div className="sidebar-brand-name">Expense<br />Tracker</div>
        </div>

        <div className="sidebar-section-label">{t('sidebar.tagline')}</div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="icon">▦</span> {t('sidebar.overview')}
          </NavLink>
          <NavLink
            to="/transactions"
            end
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="icon">☰</span> {t('sidebar.transactions')}
          </NavLink>
          <NavLink
            to="/transactions/new"
            className="sidebar-link add-record"
            onClick={() => setOpen(false)}
          >
            <span className="icon">+</span> {t('sidebar.addRecord')}
          </NavLink>
          <NavLink
            to="/budgets"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="icon">◔</span> {t('sidebar.budgets')}
          </NavLink>
          <NavLink
            to="/recurring"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="icon">↻</span> {t('sidebar.recurring')}
          </NavLink>
        </nav>

        <div className="sidebar-bell-row">
          <NotificationsBell />
          <LanguageSwitcher className="lang-select lang-select-sidebar" />
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <NavLink to="/profile" className="sidebar-user" onClick={() => setOpen(false)}>
            <div className="sidebar-user-avatar">{initials(user?.name)}</div>
            <div>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </NavLink>
          <button className="sidebar-footer-link" onClick={handleLogout}>
            <span className="icon">⎋</span> {t('sidebar.logOut')}
          </button>
        </div>
      </aside>
    </>
  );
}
