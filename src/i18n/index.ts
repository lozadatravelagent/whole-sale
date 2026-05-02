import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ES translations
import esCommon from './locales/es/common.json';
import esLanding from './locales/es/landing.json';
import esChat from './locales/es/chat.json';
import esAuth from './locales/es/auth.json';
import esErrors from './locales/es/errors.json';
import esDashboard from './locales/es/dashboard.json';
import esSettings from './locales/es/settings.json';
import esAdmin from './locales/es/admin.json';
import esPages from './locales/es/pages.json';

// EN translations
import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enChat from './locales/en/chat.json';
import enAuth from './locales/en/auth.json';
import enErrors from './locales/en/errors.json';
import enDashboard from './locales/en/dashboard.json';
import enSettings from './locales/en/settings.json';
import enAdmin from './locales/en/admin.json';
import enPages from './locales/en/pages.json';

// PT translations
import ptCommon from './locales/pt/common.json';
import ptLanding from './locales/pt/landing.json';
import ptChat from './locales/pt/chat.json';
import ptAuth from './locales/pt/auth.json';
import ptErrors from './locales/pt/errors.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptSettings from './locales/pt/settings.json';
import ptAdmin from './locales/pt/admin.json';
import ptPages from './locales/pt/pages.json';

export const SUPPORTED_LANGUAGES = ['es', 'en', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

const STORAGE_KEY = 'emilia-language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        landing: esLanding,
        chat: esChat,
        auth: esAuth,
        errors: esErrors,
        dashboard: esDashboard,
        settings: esSettings,
        admin: esAdmin,
        pages: esPages,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        chat: enChat,
        auth: enAuth,
        errors: enErrors,
        dashboard: enDashboard,
        settings: enSettings,
        admin: enAdmin,
        pages: enPages,
      },
      pt: {
        common: ptCommon,
        landing: ptLanding,
        chat: ptChat,
        auth: ptAuth,
        errors: ptErrors,
        dashboard: ptDashboard,
        settings: ptSettings,
        admin: ptAdmin,
        pages: ptPages,
      },
    },
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export { STORAGE_KEY };
export default i18n;
