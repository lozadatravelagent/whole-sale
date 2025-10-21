import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <footer className="border-t border-border py-8 sm:py-10 md:py-12 px-4 sm:px-6 mt-12 sm:mt-16 md:mt-20" role="contentinfo">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12 mb-8 sm:mb-10 md:mb-12">
          <div className="space-y-3 text-center sm:text-left">
            <img
              src={theme === 'dark' ? '/vibook-white.png' : '/vibook-black.png'}
              alt="ViBook"
              className="h-12 sm:h-14 md:h-16 mx-auto sm:mx-0"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">La forma más rápida de cotizar y vender viajes</p>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Producto</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <button onClick={() => onNavigate('como-funciona')} className="hover:text-primary transition-smooth">
                  Cómo funciona
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('precios')} className="hover:text-primary transition-smooth">
                  Precios
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/login')} className="hover:text-primary transition-smooth">
                  Demo
                </button>
              </li>
            </ul>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Recursos</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <button onClick={() => onNavigate('faqs')} className="hover:text-primary transition-smooth">
                  FAQs
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('contacto')} className="hover:text-primary transition-smooth">
                  Contacto
                </button>
              </li>
            </ul>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Empresa</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-smooth">
                  Sobre nosotros
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-smooth">
                  Blog
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 sm:pt-8 border-t border-border">
          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            © 2025 ViBook. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
