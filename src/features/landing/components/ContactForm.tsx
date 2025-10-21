import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ContactFormData } from '../types/landing';

const contactFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
});

export function ContactForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      // TODO: Implement actual form submission to backend/email service
      console.log('Form data:', data);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: '¡Mensaje enviado!',
        description: 'Nos pondremos en contacto contigo pronto.',
      });

      reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Hubo un problema al enviar el mensaje. Por favor, intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Tu nombre completo"
          {...register('name')}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          {...register('email')}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" type="tel" placeholder="+54 9 11 1234-5678" {...register('phone')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Agencia</Label>
        <Input id="company" placeholder="Nombre de tu agencia" {...register('company')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">
          Mensaje <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          placeholder="Contanos qué necesitás..."
          rows={4}
          {...register('message')}
          className={errors.message ? 'border-destructive' : ''}
        />
        {errors.message && <p className="text-sm text-destructive">{errors.message.message}</p>}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-hero hover:opacity-90 shadow-primary transition-smooth"
      >
        {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
      </Button>
    </form>
  );
}
