import { useContext } from 'react';
import { LanguageContext } from './language-context-def';
import { translations } from './translations';

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'en',
      changeLanguage: () => {},
      t: translations.en,
    };
  }
  return ctx;
}
