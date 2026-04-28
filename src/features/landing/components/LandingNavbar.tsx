import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSelector } from '@/components/LanguageSelector';
import { cn } from '@/lib/utils';
import { PrimaryButton } from './PrimaryButton';

const NAV_LINKS = [
  { id: 'valor', labelKey: 'navbar.links.valor' },
  { id: 'diferencial', labelKey: 'navbar.links.diferencial' },
  { id: 'usos', labelKey: 'navbar.links.usos' },
  { id: 'sobre', labelKey: 'navbar.links.sobre' },
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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (id: string) => {
    scrollToSection(id);
    setMobileOpen(false);
  };

  const handleStartChat = () => {
    setMobileOpen(false);
    navigate('/emilia/chat');
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out',
        scrolled ? 'py-2' : 'py-3',
      )}
    >
      <div className="container-page">
        <div
          className={cn(
            'flex items-center justify-between rounded-full px-4 sm:px-5 transition-all duration-500 ease-out',
            scrolled ? 'h-14 glass-strong' : 'h-16 bg-transparent',
          )}
        >
          <a
            href="#hero"
            aria-label={t('navbar.logoAlt')}
            className="flex items-center gap-1.5 sm:gap-2 pl-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
          >
            <svg
              viewBox="0 0 175 80"
              fill="none"
              aria-hidden="true"
              className="h-8 w-auto sm:h-11"
            >
              <circle cx="40" cy="40" r="32" stroke="rgba(124,58,237,0.18)" strokeWidth="1" fill="none" />
              <circle cx="40" cy="40" r="22" stroke="rgba(124,58,237,0.45)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
              <path d="M 40 8 A 32 32 0 0 1 72 40 A 32 32 0 0 1 40 72 A 32 32 0 0 0 8 40 A 32 32 0 0 0 40 8" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="72" cy="40" r="4" fill="#7c3aed" />
              <circle cx="72" cy="40" r="8" fill="rgba(124,58,237,0.25)" />
              <text x="88" y="50" fontFamily="'Playfair Display', serif" fontStyle="italic" fontWeight="400" fontSize="32" fill="hsl(var(--foreground))" letterSpacing="-0.5">Emilia</text>
            </svg>
            <div className="flex items-center gap-0">
              <span className="text-[10px] sm:text-[11px] lowercase text-muted-foreground">by</span>
              <img
                src="/vibook-black.png?v=2"
                alt="Vibook"
                className="h-3 sm:h-4 w-auto select-none"
                draggable={false}
              />
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2" aria-label="Landing sections">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleAnchor(link.id)}
                className="px-3.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground rounded-full hover:bg-foreground/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t(link.labelKey)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSelector showLabel={false} className="hidden md:inline-flex" />
            <PrimaryButton
              size="md"
              onClick={handleStartChat}
              className="hidden sm:inline-flex h-10"
            >
              {t('navbar.primaryCta')}
            </PrimaryButton>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10 rounded-full glass"
                  aria-label={t('navbar.openMenu')}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-background">
                <div className="flex flex-col gap-1 mt-10">
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => handleAnchor(link.id)}
                      className="text-left px-3 py-3 text-base text-foreground hover:bg-secondary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {t(link.labelKey)}
                    </button>
                  ))}
                  <div className="mt-6 flex flex-col gap-2">
                    <LanguageSelector className="w-full justify-start" />
                    <PrimaryButton onClick={handleStartChat} className="w-full">
                      {t('navbar.primaryCta')}
                    </PrimaryButton>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
