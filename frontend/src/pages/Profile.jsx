import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword } from '../api/profile';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Profile() {
  const { updateStoredUser } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    getProfile()
      .then((user) => setProfile({ name: user.name, email: user.email }))
      .catch((err) => setProfileMsg({ type: 'error', text: err.response?.data?.message || t('profile.loadFailed') }))
      .finally(() => setLoadingInitial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    if (!profile.name.trim()) return setProfileMsg({ type: 'error', text: t('profile.nameEmpty') });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      return setProfileMsg({ type: 'error', text: t('profile.invalidEmail') });
    }

    setProfileLoading(true);
    try {
      const data = await updateProfile(profile);
      updateStoredUser(data.user);
      setProfileMsg({ type: 'success', text: t('profile.updateSuccess') });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || t('profile.updateFailed') });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (!pwForm.currentPassword || !pwForm.newPassword) {
      return setPwMsg({ type: 'error', text: t('profile.bothPasswordFields') });
    }
    if (pwForm.newPassword.length < 6) {
      return setPwMsg({ type: 'error', text: t('profile.passwordLength') });
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return setPwMsg({ type: 'error', text: t('profile.passwordMismatch') });
    }

    setPwLoading(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg({ type: 'success', text: t('profile.passwordChangeSuccess') });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || t('profile.passwordChangeFailed') });
    } finally {
      setPwLoading(false);
    }
  }

  if (loadingInitial) return <div className="page-loading">{t('profile.loadingProfile')}</div>;

  return (
    <div className="page page-narrow">
      <div className="page-header-text" style={{ marginBottom: 22 }}>
        <span className="eyebrow">{t('profile.eyebrow')}</span>
        <h1 className="page-title">{t('profile.title')}</h1>
      </div>

      <form className="card form-card" onSubmit={handleProfileSubmit} noValidate style={{ maxWidth: 'none' }}>
        <h2>{t('profile.accountDetails')}</h2>
        {profileMsg.text && <div className={`alert alert-${profileMsg.type}`}>{profileMsg.text}</div>}

        <label className="field">
          <span>{t('profile.name')}</span>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </label>

        <label className="field">
          <span>{t('profile.email')}</span>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={profileLoading}>
            {profileLoading ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </form>

      <div className="card form-card" style={{ maxWidth: 'none' }}>
        <h2>{t('profile.language')}</h2>
        <p className="page-subtitle" style={{ marginBottom: 14 }}>{t('profile.languageHint')}</p>
        <label className="field" style={{ maxWidth: 260 }}>
          <span>{t('common.language')}</span>
          <LanguageSwitcher />
        </label>
      </div>

      <form className="card form-card" onSubmit={handlePasswordSubmit} noValidate style={{ maxWidth: 'none' }}>
        <h2>{t('profile.changePassword')}</h2>
        {pwMsg.text && <div className={`alert alert-${pwMsg.type}`}>{pwMsg.text}</div>}

        <label className="field">
          <span>{t('profile.currentPassword')}</span>
          <input
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            autoComplete="current-password"
          />
        </label>

        <label className="field">
          <span>{t('profile.newPassword')}</span>
          <input
            type="password"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            autoComplete="new-password"
          />
        </label>

        <label className="field">
          <span>{t('profile.confirmNewPassword')}</span>
          <input
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
            autoComplete="new-password"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={pwLoading}>
            {pwLoading ? t('profile.updating') : t('profile.updatePassword')}
          </button>
        </div>
      </form>
    </div>
  );
}
