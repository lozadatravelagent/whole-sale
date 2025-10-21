import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function Features() {
  const section = useIntersectionObserver();

  const features = [
    {
      emoji: '💡',
      title: 'Propuestas inteligentes',
      description:
        'Armá ofertas claras, personalizadas y listas para enviar en segundos. La IA te ayuda a destacar lo mejor de cada viaje, sin esfuerzo.',
    },
    {
      emoji: '⚡',
      title: 'Cotizaciones rápidas',
      description:
        'Generá itinerarios y presupuestos completos en cuestión de segundos. Más agilidad, más respuestas, más ventas.',
    },
    {
      emoji: '📁',
      title: 'Seguimiento simple',
      description:
        'Todo el historial de cotizaciones y clientes en un solo lugar. Nada se pierde, todo queda registrado y a un clic de distancia.',
    },
    {
      emoji: '🤖',
      title: 'IA como copiloto',
      description:
        'Una IA que entiende cómo trabajás y te acompaña en cada paso. Más precisión, menos tareas repetitivas, todo fluye.',
    },
  ];

  return (
    <section
      ref={section.ref}
      className={`py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-muted/30 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="space-y-2 sm:space-y-3 text-center sm:text-left p-4 sm:p-0 hover:scale-105 transition-smooth"
            >
              <h3 className="text-base sm:text-lg md:text-xl font-semibold">
                {feature.emoji} {feature.title}
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
