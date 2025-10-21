import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Send } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function HowItWorks() {
  const navigate = useNavigate();
  const section = useIntersectionObserver();

  const steps = [
    {
      step: 1,
      icon: Search,
      iconBg: 'bg-gradient-hero',
      shadow: 'shadow-primary',
      color: 'text-primary',
      title: 'Tu cliente pregunta',
      description: 'Recibís la consulta por WhatsApp, email o directo en ViBook',
    },
    {
      step: 2,
      icon: Sparkles,
      iconBg: 'bg-gradient-accent',
      shadow: 'shadow-accent',
      color: 'text-accent',
      title: 'La IA trabaja por vos',
      description: 'Emilia busca opciones, compara precios y arma propuestas personalizadas',
    },
    {
      step: 3,
      icon: Send,
      iconBg: 'bg-gradient-hero',
      shadow: 'shadow-primary',
      color: 'text-primary',
      title: 'Enviás y cerrás',
      description: 'Propuesta lista para enviar. Seguimiento automático hasta cerrar la venta',
    },
  ];

  return (
    <section
      ref={section.ref}
      id="como-funciona"
      className={`py-12 sm:py-16 md:py-20 px-4 sm:px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10 sm:mb-14 md:mb-16">
          <Badge variant="secondary" className="text-xs sm:text-sm px-3 sm:px-4 py-1 mb-3 sm:mb-4">
            Cómo funciona
          </Badge>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
            Tres pasos para transformar
            <br />
            <span className="text-muted-foreground">tu forma de vender</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-3 sm:mt-4 px-4">
            Descubrí lo fácil que es vender cuando la tecnología trabaja para vos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="space-y-4 sm:space-y-6 text-center p-4 hover:scale-105 transition-smooth">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl ${step.iconBg} flex items-center justify-center ${step.shadow}`}
                >
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <div className={`text-xs sm:text-sm font-medium ${step.color}`}>Paso {step.step}</div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold">{step.title}</h3>
                  <p className="text-xs sm:text-sm md:text-base text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 sm:mt-14 md:mt-16 text-center px-4">
          <Button
            size="lg"
            onClick={() => navigate('/login')}
            className="text-sm sm:text-base bg-gradient-hero hover:opacity-90 shadow-primary transition-smooth hover:shadow-lg hover:scale-105"
          >
            🎯 Probá ViBook gratis por 15 días
          </Button>
          <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
            Descubrí lo fácil que es vender cuando la tecnología trabaja para vos.
          </p>
        </div>
      </div>
    </section>
  );
}
