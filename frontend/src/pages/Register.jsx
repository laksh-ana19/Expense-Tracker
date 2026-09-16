import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) return setError(t('auth.nameRequired'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError(t('auth.invalidEmail'));
    if (form.password.length < 6) return setError(t('auth.passwordLength'));
    if (form.password !== form.confirmPassword) return setError(t('auth.passwordMismatch'));

    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      setSuccess(t('auth.accountCreated'));
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || t('auth.registerFailed'));
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
        <h1>{t('auth.createYourAccount')}</h1>
        <p className="auth-subtitle">{t('auth.registerSubtitle')}</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <label className="field">
          <span>{t('auth.name')}</span>
          <input name="name" type="text" value={form.name} onChange={handleChange} placeholder="Jane Doe" autoComplete="name" />
        </label>

        <label className="field">
          <span>{t('auth.email')}</span>
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="jane@example.com" autoComplete="email" />
        </label>

        <label className="field">
          <span>{t('auth.password')}</span>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder={t('auth.password')} autoComplete="new-password" />
        </label>

        <label className="field">
          <span>{t('auth.confirmPassword')}</span>
          <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder={t('auth.confirmPassword')} autoComplete="new-password" />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? t('auth.creatingAccount') : t('auth.register')}
        </button>

        <p className="auth-switch">
          {t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.logIn')}</Link>
        </p>
      </form>
    </div>
  );
}
