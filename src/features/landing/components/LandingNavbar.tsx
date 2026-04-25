import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSelector } from '@/components/LanguageSelector';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { id: 'how-it-works', targetId: 'how-it-works', labelKey: 'navbar.links.howItWorks' },
  { id: 'solutions', targetId: 'solutions', labelKey: 'navbar.links.solutions' },
  { id: 'models', targetId: 'models', labelKey: 'navbar.links.models' },
  { id: 'about-vibook', targetId: 'about-vibook', labelKey: 'navbar.links.aboutVibook' },
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
            className="flex items-baseline gap-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
          >
            <span className="font-semibold tracking-[0.18em] text-lg">
              {t('navbar.logoAlt')}
            </span>
            <span className="text-sm font-medium text-muted-foreground tracking-tight">
              {t('navbar.submark')}
            </span>
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
