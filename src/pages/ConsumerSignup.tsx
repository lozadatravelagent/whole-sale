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
  consumerSignupSchema,
  type ConsumerSignupFormData,
} from '@/features/auth/utils/consumerAuthSchema';
import { decideAuthRedirectAction } from '@/features/auth/utils/authRedirectDecider';
import {
  signUpConsumer,
  signInConsumer,
} from '@/features/auth/services/consumerAuthService';

export default function ConsumerSignup() {
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
    else if (action === 'dashboard') navigate('/emilia/dashboard', { replace: true });
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
        title: t('signup.toast.error'),
        description: signupResult.message,
        variant: 'destructive',
      });
      return;
    }

    const signinResult = await signInConsumer(data.email, data.password);
    setIsSubmitting(false);

    if (!signinResult.ok) {
      toast({
        title: t('signup.toast.createdNeedLogin'),
        description: t('signup.toast.createdNeedLoginDescription'),
      });
      navigate('/login', { replace: true });
      return;
    }

    toast({
      title: t('signup.toast.success'),
      description: t('signup.toast.successDescription'),
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
          <CardTitle className="text-2xl">{t('signup.title')}</CardTitle>
          <CardDescription className="text-white/70">
            {t('signup.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-name">{t('signup.name.label')}</Label>
              <Input
                id="signup-name"
                placeholder={t('signup.name.placeholder')}
                autoComplete="name"
                {...form.register('name')}
              />
              {errors.name && (
                <span className="text-xs text-destructive">{errors.name.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-email">{t('signup.email.label')}</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder={t('signup.email.placeholder')}
                autoComplete="email"
                {...form.register('email')}
              />
              {errors.email && (
                <span className="text-xs text-destructive">{errors.email.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-password">{t('signup.password.label')}</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder={t('signup.password.placeholder')}
                autoComplete="new-password"
                {...form.register('password')}
              />
              {errors.password && (
                <span className="text-xs text-destructive">{errors.password.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-confirm">{t('signup.confirmPassword.label')}</Label>
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
              {t('signup.submit')}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-white/70">
              {t('signup.loginLink')}{' '}
              <Link to="/login" className="text-primary hover:underline">
                {t('signup.loginLinkAction')}
              </Link>
            </p>
            <LanguageSelector showLabel={false} variant="ghost" className="text-white/70" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
