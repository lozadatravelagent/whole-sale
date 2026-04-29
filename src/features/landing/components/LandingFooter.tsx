import { useTranslation } from 'react-i18next';

export function LandingFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 py-10 bg-background">
      <div className="container-page flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg width="38" height="38" viewBox="0 0 80 80" fill="none" aria-label={t('navbar.logoAlt')} role="img">
            <circle cx="40" cy="40" r="32" stroke="rgba(124,58,237,0.18)" strokeWidth="1" fill="none" />
            <circle cx="40" cy="40" r="22" stroke="rgba(124,58,237,0.45)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
            <path d="M 40 8 A 32 32 0 0 1 72 40 A 32 32 0 0 1 40 72 A 32 32 0 0 0 8 40 A 32 32 0 0 0 40 8" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="72" cy="40" r="8" fill="rgba(124,58,237,0.25)" />
            <circle cx="72" cy="40" r="4" fill="#7c3aed" />
          </svg>
          <div className="flex items-center gap-1">
            <span className="text-[11px] lowercase text-muted-foreground leading-none">by</span>
            <img
              src="/vibook-black.png?v=2"
              alt="Vibook"
              className="h-3.5 w-auto select-none"
              draggable={false}
            />
          </div>
        </div>
        <div>
          © {year} {t('footer.copyrightVendor')} {t('footer.copyrightSuffix')}
        </div>
      </div>
    </footer>
  );
}
