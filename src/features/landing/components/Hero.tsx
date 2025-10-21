import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LandingChatPreview } from './LandingChatPreview';

export function Hero() {
  const navigate = useNavigate();

  return (
    <section id="inicio" className="pt-20 sm:pt-28 md:pt-32 pb-8 sm:pb-16 px-4 sm:px-6 animate-fade-in">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center space-y-4 sm:space-y-6 mb-8 sm:mb-12">
          <Badge variant="secondary" className="text-xs sm:text-sm px-3 sm:px-4 py-1.5">
            IA para agencias de viajes
          </Badge>

          <h1 className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight px-2 sm:px-4">
            La forma más rápida de cotizar
            <br className="hidden sm:block" />
            <span className="sm:inline"> </span>y vender viajes
          </h1>

          <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto px-2 sm:px-4">
            ViBook es una plataforma de inteligencia artificial pensada para agencias de viajes. Te ayuda a cotizar,
            hacer seguimiento y enviar propuestas en segundos, conectada directamente con tus mayoristas.
          </p>

          <Button
            size="lg"
            className="bg-gradient-hero hover:opacity-90 text-white px-6 sm:px-8 text-sm sm:text-base shadow-primary transition-smooth hover:shadow-lg hover:scale-105"
            onClick={() => navigate('/login')}
          >
            Quiero potenciar mi agencia
          </Button>
        </div>

        {/* Main Product Screenshot - Chat Demo */}
        <div className="mt-8 sm:mt-12 md:mt-16">
          <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden border border-border shadow-2xl bg-card">
            <div className="h-[300px] sm:h-[450px] md:h-[550px] lg:h-[600px]">
              <LandingChatPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
