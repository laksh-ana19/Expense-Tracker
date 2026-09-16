import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getNotifications } from '../api/notifications';

const DISMISSED_KEY = 'dismissedNotificationIds';

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

export default function NotificationsBell() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getNotifications().then((data) => { if (!cancelled) setItems(data); }).catch(() => {});
    // Re-check periodically so a bill that becomes due while the app is open still shows up.
    const interval = setInterval(() => {
      getNotifications().then((data) => { if (!cancelled) setItems(data); }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const visible = items.filter((n) => !dismissed.has(n.id));

  function dismiss(id) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell" onClick={() => setOpen((o) => !o)} title={t('notifications.title')}>
        🔔
        {visible.length > 0 && <span className="notif-count">{visible.length}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">{t('notifications.title')}</div>
          {visible.length === 0 ? (
            <p className="empty-state" style={{ padding: '18px 14px' }}>{t('notifications.caughtUp')}</p>
          ) : (
            <div className="notif-list">
              {visible.map((n) => (
                <div className={`notif-item ${n.severity === 'over' ? 'over' : ''}`} key={n.id}>
                  <span className="notif-icon">{n.type === 'budget' ? '💰' : '📅'}</span>
                  <span className="notif-text">{n.message}</span>
                  <button className="notif-dismiss" onClick={() => dismiss(n.id)} title={t('common.cancel')}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
