import { Badge } from '@/components/ui/badge';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { ContactForm } from './ContactForm';

export function Contact() {
  const section = useIntersectionObserver();

  return (
    <section
      ref={section.ref}
      id="contacto"
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <Badge variant="secondary" className="text-sm px-4 py-1 mb-4">
                Contacto
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Hablemos de cómo
                <br />
                escalar tu operación
              </h2>
              <p className="text-lg text-muted-foreground">
                Automatizá procesos, vendé más y ganá eficiencia con IA pensada para agencias de viaje
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6">¿Tenés dudas? Escribinos</h3>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
