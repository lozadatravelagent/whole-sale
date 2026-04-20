import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function LandingFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-12 mt-16">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/vibook-white.png"
              alt={t('footer.vibookLogoAlt')}
              className="h-6 w-auto opacity-80"
            />
            <span className="text-sm text-muted-foreground">{t('footer.tagline')}</span>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-5">
            <Link
              to="/privacidad"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.links.privacy')}
            </Link>
            <Link
              to="/terminos"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.links.terms')}
            </Link>
            <Link
              to="/contacto"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.links.contact')}
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          {t('footer.copyright', { year })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {t('footer.photoCredit')}
        </p>
      </div>
    </footer>
  );
}
