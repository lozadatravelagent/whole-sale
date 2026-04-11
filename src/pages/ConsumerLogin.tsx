import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import {
  consumerLoginSchema,
  type ConsumerLoginFormData,
} from '@/features/companion/utils/consumerAuthSchema';
import { decideAuthRedirectAction } from '@/features/companion/utils/authRedirectDecider';
import {
  signInConsumer,
  fetchUserAccountType,
  signOutConsumer,
} from '@/features/companion/services/consumerAuthService';

export default function ConsumerLogin() {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
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

  const form = useForm<ConsumerLoginFormData>({
    resolver: zodResolver(consumerLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: ConsumerLoginFormData) => {
    setIsSubmitting(true);

    const result = await signInConsumer(data.email, data.password);

    if (!result.ok) {
      setIsSubmitting(false);
      toast({
        title: t('login.toast.error'),
        description: result.message,
        variant: 'destructive',
      });
      return;
    }

    // Verify the freshly-authenticated user is actually a consumer. If an
    // agent logs in here, redirect them to their B2B workspace instead of
    // dropping them into the companion chat.
    const accountType = await fetchUserAccountType(result.userId);
    setIsSubmitting(false);

    if (accountType === 'agent') {
      toast({
        title: t('login.toast.agentRedirect'),
        description: t('login.toast.agentRedirectDescription'),
      });
      navigate('/dashboard', { replace: true });
      return;
    }

    if (accountType !== 'consumer') {
      toast({
        title: t('login.toast.accountNotConfigured'),
        description: t('login.toast.accountNotConfiguredDescription'),
        variant: 'destructive',
      });
      await signOutConsumer();
      return;
    }

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
          <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
          <CardDescription className="text-white/70">
            {t('login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-email">{t('login.email.label')}</Label>
              <Input
                id="login-email"
                type="email"
                placeholder={t('login.email.placeholder')}
                autoComplete="email"
                {...form.register('email')}
              />
              {errors.email && (
                <span className="text-xs text-destructive">{errors.email.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="login-password">{t('login.password.label')}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {errors.password && (
                <span className="text-xs text-destructive">{errors.password.message}</span>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('login.submit')}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-white/70">
              {t('login.signupLink')}{' '}
              <Link to="/emilia/signup" className="text-primary hover:underline">
                {t('login.signupLinkAction')}
              </Link>
            </p>
            <LanguageSelector showLabel={false} variant="ghost" className="text-white/70" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
