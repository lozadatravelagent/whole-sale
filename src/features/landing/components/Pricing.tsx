import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { PricingCard } from './PricingCard';
import { pricingPlans } from '../data/landingData';

export function Pricing() {
  const navigate = useNavigate();
  const section = useIntersectionObserver();
  const [showAnnual, setShowAnnual] = useState(true);

  return (
    <section
      ref={section.ref}
      id="precios"
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="text-sm px-4 py-1 mb-4">
            Para agencias de todos los tamaños
          </Badge>

          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Planes pensados para
            <br />
            <span className="text-muted-foreground">escalar tu operación</span>
          </h2>

          <p className="text-muted-foreground text-lg mb-8">Elegí la opción que mejor se adapta al tamaño de tu equipo</p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <Label
              htmlFor="pricing-toggle"
              className={`text-sm cursor-pointer transition-colors ${
                !showAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Mensual
            </Label>
            <Switch
              id="pricing-toggle"
              checked={showAnnual}
              onCheckedChange={setShowAnnual}
              aria-label="Cambiar entre facturación mensual y anual"
            />
            <Label
              htmlFor="pricing-toggle"
              className={`text-sm cursor-pointer transition-colors ${
                showAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Anual
              <Badge variant="secondary" className="ml-2 text-xs">
                Ahorrá 20%
              </Badge>
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan) => (
            <PricingCard
              key={plan.id}
              {...plan}
              showAnnual={showAnnual}
              onCtaClick={() => navigate('/login')}
            />
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          15 días de prueba gratuita • Abierto a nuevas integraciones
        </p>
      </div>
    </section>
  );
}
