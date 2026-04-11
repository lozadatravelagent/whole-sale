import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@/i18n';

/**
 * Hook for managing user language preference.
 * Encapsulates i18n state and syncs with AuthContext for persistence.
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const { setPreferredLanguage } = useAuth();

  // Normalize language code (e.g., 'en-US' -> 'en')
  const rawLang = i18n.language?.split('-')[0] || 'es';
  const currentLanguage = (
    SUPPORTED_LANGUAGES.includes(rawLang as SupportedLanguage) ? rawLang : 'es'
  ) as SupportedLanguage;

  const changeLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      await setPreferredLanguage(lang);
    },
    [setPreferredLanguage]
  );

  return {
    language: currentLanguage,
    changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    languageLabels: LANGUAGE_LABELS,
  };
}

export type { SupportedLanguage };
