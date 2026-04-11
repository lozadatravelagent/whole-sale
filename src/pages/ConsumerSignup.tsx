import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  consumerSignupSchema,
  type ConsumerSignupFormData,
} from '@/features/companion/utils/consumerAuthSchema';
import { decideAuthRedirectAction } from '@/features/companion/utils/authRedirectDecider';
import {
  signUpConsumer,
  signInConsumer,
} from '@/features/companion/services/consumerAuthService';

export default function ConsumerSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, isAgent, isConsumer } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const action = decideAuthRedirectAction({
      loading,
      userPresent: Boolean(user),
      isConsumer,
      isAgent,
    });
    if (action === 'chat') navigate('/emilia/chat', { replace: true });
    else if (action === 'dashboard') navigate('/dashboard', { replace: true });
  }, [user, loading, isAgent, isConsumer, navigate]);

  const form = useForm<ConsumerSignupFormData>({
    resolver: zodResolver(consumerSignupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ConsumerSignupFormData) => {
    setIsSubmitting(true);

    const signupResult = await signUpConsumer({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    if (!signupResult.ok) {
      setIsSubmitting(false);
      toast({
        title: 'No se pudo crear la cuenta',
        description: signupResult.message,
        variant: 'destructive',
      });
      return;
    }

    const signinResult = await signInConsumer(data.email, data.password);
    setIsSubmitting(false);

    if (!signinResult.ok) {
      toast({
        title: 'Cuenta creada',
        description: 'Tu cuenta se creó. Iniciá sesión para continuar.',
      });
      navigate('/emilia/login', { replace: true });
      return;
    }

    toast({
      title: '¡Bienvenido a Emilia!',
      description: 'Tu cuenta está lista.',
    });
    navigate('/emilia/chat', { replace: true });
  };

  const errors = form.formState.errors;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040814] px-4 py-12">
      <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-sm text-white">
        <CardHeader className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Emilia</span>
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription className="text-white/70">
            Planificá tu próximo viaje con una asistente que aprende a tu ritmo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-name">Nombre</Label>
              <Input
                id="signup-name"
                placeholder="Tu nombre"
                autoComplete="name"
                {...form.register('name')}
              />
              {errors.name && (
                <span className="text-xs text-destructive">{errors.name.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                {...form.register('email')}
              />
              {errors.email && (
                <span className="text-xs text-destructive">{errors.email.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-password">Contraseña</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                {...form.register('password')}
              />
              {errors.password && (
                <span className="text-xs text-destructive">{errors.password.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-confirm">Repetí la contraseña</Label>
              <Input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <span className="text-xs text-destructive">{errors.confirmPassword.message}</span>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-white/70">
            ¿Ya tenés cuenta?{' '}
            <Link to="/emilia/login" className="text-primary hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
