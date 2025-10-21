import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { faqs } from '../data/landingData';

interface FAQProps {
  onNavigateToContact: () => void;
}

export function FAQ({ onNavigateToContact }: FAQProps) {
  const section = useIntersectionObserver();

  return (
    <section
      ref={section.ref}
      id="faqs"
      className={`py-20 px-6 transition-all duration-1000 ${
        section.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="text-sm px-4 py-1 mb-4">
            FAQs
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold">Preguntas frecuentes</h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={`item-${index + 1}`}
              value={`item-${index + 1}`}
              className="border border-border rounded-2xl px-6 hover:border-primary hover:shadow-primary transition-smooth"
            >
              <AccordionTrigger className="text-left hover:no-underline">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">¿Seguís con dudas? Estamos para ayudarte</p>
          <Button
            variant="outline"
            onClick={onNavigateToContact}
            className="hover:bg-primary/10 hover:border-primary transition-smooth"
          >
            Contactanos
          </Button>
        </div>
      </div>
    </section>
  );
}
