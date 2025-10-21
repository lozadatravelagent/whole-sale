import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, BarChart3, Clock, Zap } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { crmFeatures } from '../data/landingData';

export function CRM() {
  const navigate = useNavigate();
  const section = useIntersectionObserver();

  const iconMap = {
    Users,
    BarChart3,
    Clock,
    Zap,
  };

  return (
    <section
      ref={section.ref}
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="text-sm px-4 py-1">
              CRM Ligero
            </Badge>

            <h2 className="text-4xl md:text-5xl font-bold">
              Seguimiento comercial
              <br />
              <span className="text-muted-foreground">sin dolores de cabeza</span>
            </h2>

            <p className="text-lg text-muted-foreground">
              Perder tiempo buscando cotizaciones, cargar los mismos datos una y otra vez o dejar pasar un cliente por
              distracción, es cosa del pasado. Con ViBook, todo queda guardado y organizado automáticamente.
            </p>

            <p className="text-lg text-muted-foreground">
              Tu cotización, el historial y los recordatorios se sincronizan sin que tengas que hacer nada. Cotizás,
              enviás y seguís. Todo fluye.
            </p>

            <Button
              size="lg"
              onClick={() => navigate('/login')}
              className="bg-gradient-hero hover:opacity-90 shadow-primary transition-smooth hover:shadow-lg hover:scale-105"
            >
              Solicitar demo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {crmFeatures.map((feature, index) => {
              const Icon = iconMap[feature.icon];
              return (
                <div key={index} className="space-y-3 transition-smooth hover:scale-105">
                  <div className="w-12 h-12 rounded-xl bg-gradient-hero flex items-center justify-center shadow-primary">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
