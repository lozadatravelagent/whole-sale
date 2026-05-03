import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSelector } from '@/components/LanguageSelector';
import {
  AuroraBackdrop,
  GlassCard,
  MeridianHeading,
  MeridianMono,
  OrbitMark,
} from '@/components/meridian';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const sessionExpired = searchParams.get('expired') === 'true';

  useEffect(() => {
    const root = window.document.documentElement;
    const hadDarkTheme = root.classList.contains('dark');
    root.classList.remove('dark');

    return () => {
      if (hadDarkTheme) {
        root.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    const from = (location.state as any)?.from?.pathname || '/emilia/chat';
    navigate(from, { replace: true });
  }, [user, authLoading, navigate, location]);

  useEffect(() => {
    if (sessionExpired) {
      toast({
        title: 'Sesión expirada',
        description: 'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
        variant: 'destructive',
      });
    }
  }, [sessionExpired, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        toast({ title: 'Login exitoso', description: '¡Bienvenido!' });
      }
    } catch (error: any) {
      toast({
        title: 'Error en el login',
        description: error.message || 'Verifica tus credenciales e intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error en Google Login',
        description: error.message || 'Error al iniciar sesión con Google.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="relative h-screen overflow-hidden bg-background text-foreground">
        <AuroraBackdrop intensity="subtle" />
        <div className="relative z-10 flex h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
          <div className="text-center">
            <OrbitMark size={80} animated />
            <MeridianMono className="mt-6 block text-muted-foreground">
              CARGANDO · EMILIA
            </MeridianMono>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      {/* Atmospheric layer — orbs + grid + grain */}
      <AuroraBackdrop intensity="full" withGrid withGrain />

      <div className="relative z-10 flex h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-md animate-meridian-fade-up">
          {/* Brand mark above the card */}
          <div className="mb-8 flex flex-col items-center">
            <div className="relative">
              <OrbitMark size={96} animated />
              {/* Glow halo behind */}
              <div
                aria-hidden
                className="absolute inset-0 -z-10 animate-meridian-glow-pulse"
                style={{
                  background:
                    'radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)',
                }}
              />
            </div>
          </div>

          <GlassCard level={2} className="rounded-3xl p-8 sm:p-10">
            <div className="mb-7 space-y-2 text-center">
              <MeridianHeading as="h1" size="md" gradient italic>
                Bienvenido<br />de vuelta.
              </MeridianHeading>
              <p className="font-sans text-sm font-light leading-relaxed text-muted-foreground">
                Iniciá sesión para continuar la conversación.
              </p>
            </div>

            {sessionExpired && (
              <Alert variant="destructive" className="mb-5">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-utility text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Correo
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="vos@agencia.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl border-border/50 bg-background/60 pl-11 transition-all duration-300 ease-out-expo focus-visible:border-primary/40 focus-visible:bg-background/80"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-utility text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-2xl border-border/50 bg-background/60 pl-11 transition-all duration-300 ease-out-expo focus-visible:border-primary/40 focus-visible:bg-background/80"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="meridian"
                size="meridian-md"
                className="w-full h-12"
                disabled={loading}
              >
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </form>

            {/* Separator with Meridian mono label */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border/70" />
              <MeridianMono className="text-muted-foreground/60" size="xs">
                O CONTINUAR CON
              </MeridianMono>
              <div className="h-px flex-1 bg-border/70" />
            </div>

            <Button
              type="button"
              variant="meridian-glass"
              size="meridian-md"
              onClick={handleGoogleLogin}
              className="w-full h-12"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
            </Button>

            <div className="mt-6 flex items-center justify-between text-sm">
              <p className="font-sans text-muted-foreground">
                ¿No tenés cuenta?{' '}
                <Link
                  to="/emilia/signup"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Registrate
                </Link>
              </p>
              <LanguageSelector showLabel={false} variant="ghost" />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default Login;
