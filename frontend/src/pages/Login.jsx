import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      return setError(t('auth.bothFieldsRequired'));
    }

    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-brand">
          <div className="auth-brand-icon">🧾</div>
          <div className="auth-brand-name">{t('common.appName')}</div>
        </div>
        <h1>{t('auth.welcomeBack')}</h1>
        <p className="auth-subtitle">{t('auth.loginSubtitle')}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>{t('auth.email')}</span>
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="jane@example.com" autoComplete="email" />
        </label>

        <label className="field">
          <span>{t('auth.password')}</span>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder={t('auth.password')} autoComplete="current-password" />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.logIn')}
        </button>

        <p className="auth-switch">
          {t('auth.newHere')} <Link to="/register">{t('auth.createAccount')}</Link>
        </p>
      </form>
    </div>
  );
}
