import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { scaleFeatures } from '../data/landingData';

export function Scale() {
  const section = useIntersectionObserver();

  return (
    <section
      ref={section.ref}
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-4xl text-center space-y-12">
        <Badge variant="secondary" className="text-sm px-4 py-1">
          Preparado para crecer
        </Badge>

        <h2 className="text-4xl md:text-5xl font-bold">
          Escalá tu agencia,
          <br />
          <span className="text-muted-foreground">sin sumar más trabajo</span>
        </h2>

        <p className="text-xl text-muted-foreground">
          Atendé más clientes, cerrá más ventas y mantené el control sin agrandar tu equipo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pt-8">
          {scaleFeatures.map((feature, index) => (
            <div key={index} className="flex items-start space-x-3 transition-smooth hover:translate-x-2">
              <Check className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-muted-foreground">{feature}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
