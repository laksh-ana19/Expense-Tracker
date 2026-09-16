import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

// A plain <select> keeps this accessible and simple to style; it's reused in
// both the sidebar (compact) and the Profile page (labelled).
export default function LanguageSwitcher({ className = 'lang-select' }) {
  const { i18n } = useTranslation();

  function handleChange(e) {
    i18n.changeLanguage(e.target.value);
  }

  return (
    <select
      className={className}
      value={i18n.resolvedLanguage || i18n.language}
      onChange={handleChange}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      ))}
    </select>
  );
}
