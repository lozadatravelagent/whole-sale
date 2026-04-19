import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSelector } from '@/components/LanguageSelector';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { id: 'agencies', targetId: 'ecosystem-agencies', labelKey: 'navbar.links.agencies' },
  { id: 'wholesalers', targetId: 'ecosystem-wholesalers', labelKey: 'navbar.links.wholesalers' },
] as const;

function scrollToSection(id: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingNavbar() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (id: string) => {
    scrollToSection(id);
    setMobileOpen(false);
  };

  const handleStartChat = () => {
    navigate('/emilia/chat');
    setMobileOpen(false);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16">
          <a
            href="/emilia"
            className="text-foreground font-semibold tracking-tight text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
          >
            {t('navbar.logoAlt')}
          </a>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Landing sections">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleAnchor(link.targetId)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t(link.labelKey)}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <LanguageSelector />
            <Button onClick={handleStartChat} size="sm">
              {t('navbar.primaryCta')}
            </Button>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t('navbar.openMenu')}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <div className="flex flex-col gap-2 mt-10">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleAnchor(link.targetId)}
                    className="text-left px-3 py-3 text-base text-foreground hover:bg-secondary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t(link.labelKey)}
                  </button>
                ))}
                <div className="mt-6 flex flex-col gap-2">
                  <LanguageSelector className="w-full justify-start" />
                  <Button onClick={handleStartChat} className="w-full">
                    {t('navbar.primaryCta')}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
