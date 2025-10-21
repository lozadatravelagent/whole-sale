import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Target } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function Results() {
  const section = useIntersectionObserver();

  const metrics = [
    {
      value: '80%',
      title: 'menos tiempo operativo',
      description: 'La IA se encarga del trabajo repetitivo. Vos te enfocás en cerrar ventas.',
      icon: Clock,
      iconBg: 'bg-gradient-hero',
      shadow: 'shadow-primary',
    },
    {
      value: '4×',
      title: 'más cotizaciones por día',
      description: 'Emilia responde en minutos, no en horas. Cada consulta se convierte en oportunidad.',
      icon: TrendingUp,
      iconBg: 'bg-gradient-accent',
      shadow: 'shadow-accent',
    },
    {
      value: '+60%',
      title: 'más cierres',
      description: 'Responder rápido marca la diferencia. Con ViBook, siempre llegás primero.',
      icon: Target,
      iconBg: 'bg-gradient-hero',
      shadow: 'shadow-primary',
    },
  ];

  return (
    <section
      ref={section.ref}
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="text-sm px-4 py-1 mb-4">
            Resultados reales
          </Badge>

          <h2 className="text-4xl md:text-5xl font-bold">
            Agencias que venden
            <br />
            <span className="text-muted-foreground">más con ViBook</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="space-y-6 text-center transition-smooth hover:scale-105">
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl ${metric.iconBg} flex items-center justify-center ${metric.shadow}`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-bold">
                    {metric.value}
                  </div>
                  <div className="text-xl font-semibold">{metric.title}</div>
                  <p className="text-muted-foreground">{metric.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonial */}
        <div className="bg-muted/50 rounded-3xl p-8 md:p-12 border border-border">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <p className="text-xl md:text-2xl">
              💬 "Desde que usamos ViBook hacemos en una mañana lo que antes nos llevaba todo el día. Los clientes
              reciben sus cotizaciones al instante y eso nos hizo vender mucho más."
            </p>
            <div className="flex items-center justify-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-lg font-bold">MG</span>
              </div>
              <div className="text-left">
                <div className="font-semibold">María García</div>
                <div className="text-sm text-muted-foreground">Dueña de agencia de viajes</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
