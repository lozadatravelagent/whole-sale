import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavigationProps {
  onNavigate: (sectionId: string) => void;
}

export function Navigation({ onNavigate }: NavigationProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Inicio', id: 'inicio' },
    { label: 'Cómo funciona', id: 'como-funciona' },
    { label: 'Precios', id: 'precios' },
    { label: 'Contacto', id: 'contacto' },
    { label: 'FAQs', id: 'faqs' },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-lg'
          : 'bg-transparent border-b border-transparent'
      }`}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="container mx-auto px-4 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={theme === 'dark' ? '/vibook-white.png' : '/vibook-black.png'}
              alt="ViBook Logo"
              className="h-12 sm:h-14 md:h-16"
            />
          </div>

          <div className="hidden lg:flex items-center space-x-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-sm hover:text-primary transition-smooth"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle variant="default" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/login')}
              className="hidden md:inline-flex text-xs sm:text-sm hover:border-primary hover:text-primary transition-smooth"
            >
              Demo
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-gradient-hero hover:opacity-90 text-white text-xs sm:text-sm px-2 sm:px-4 shadow-primary transition-smooth hover:scale-105"
            >
              Iniciar sesión
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 space-y-2 border-t border-border pt-4 animate-fade-in">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="block w-full text-left px-4 py-2 hover:bg-muted rounded-lg transition-colors text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
