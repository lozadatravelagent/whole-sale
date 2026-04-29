import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LandingLayout } from '@/features/landing/components/LandingLayout';
import { AuroraBackdrop } from '@/features/landing/components/AuroraBackdrop';
import { PrimaryButton } from '@/features/landing/components/PrimaryButton';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function EmiliaWhitelist() {
  const { t, i18n } = useTranslation('landing');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorKey, setErrorKey] = useState<'errorInvalid' | 'errorDuplicate' | 'errorGeneric' | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setErrorKey('errorInvalid');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorKey(null);

    // @ts-expect-error - waitlist table types not regenerated yet
    const { error } = await supabase.from('waitlist').insert({
      email: trimmed,
      language: i18n.language,
      source: 'landing',
    });

    if (error) {
      const isDuplicate = error.code === '23505' || /duplicate|unique/i.test(error.message ?? '');
      setErrorKey(isDuplicate ? 'errorDuplicate' : 'errorGeneric');
      setStatus('error');
      return;
    }

    setStatus('success');
  };

  return (
    <LandingLayout>
      <section className="relative pt-24 md:pt-28 pb-10 md:pb-14 overflow-hidden grain">
        <AuroraBackdrop variant="hero" />

        <div className="container-page relative">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl mx-auto text-center"
          >
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                type="button"
                onClick={() => navigate('/emilia')}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('whitelist.back')}
              </button>

              <div className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-primary">
                  {t('whitelist.eyebrow')}
                </span>
              </div>
            </div>

            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass-strong rounded-[2rem] p-8 sm:p-10"
              >
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-5">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="display-lg text-2xl sm:text-3xl text-foreground">
                  {t('whitelist.successTitle')}
                </h1>
                <p className="mt-4 text-base text-muted-foreground">
                  {t('whitelist.successSubtitle')}
                </p>
                <div className="mt-8 flex justify-center">
                  <PrimaryButton size="md" onClick={() => navigate('/emilia')} showArrow={false}>
                    {t('whitelist.successCta')}
                  </PrimaryButton>
                </div>
              </motion.div>
            ) : (
              <>
                <h1 className="display-lg text-3xl sm:text-5xl md:text-6xl text-foreground">
                  {t('whitelist.title')}{' '}
                  <span className="text-gradient">{t('whitelist.titleHighlight')}</span>
                </h1>
                <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {t('whitelist.subtitle')}
                </p>

                <form onSubmit={handleSubmit} className="mt-8 glass-strong rounded-[1.6rem] p-2 text-left">
                  <div className="rounded-[1.2rem] bg-white/85 backdrop-blur-xl p-4 sm:p-5">
                    <label htmlFor="whitelist-email" className="block text-[12px] font-semibold tracking-tight text-foreground mb-2">
                      {t('whitelist.emailLabel')}
                    </label>
                    <input
                      id="whitelist-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === 'error') {
                          setStatus('idle');
                          setErrorKey(null);
                        }
                      }}
                      placeholder={t('whitelist.emailPlaceholder')}
                      disabled={status === 'submitting'}
                      className="w-full h-12 rounded-full bg-white/95 border border-border/60 px-5 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all disabled:opacity-60"
                    />
                    {status === 'error' && errorKey && (
                      <p className="mt-2 text-[12px] text-red-600">{t(`whitelist.${errorKey}`)}</p>
                    )}
                    <div className="mt-5 flex justify-center">
                      <PrimaryButton
                        type="submit"
                        size="lg"
                        disabled={status === 'submitting'}
                        showArrow={status !== 'submitting'}
                        className="w-full sm:w-auto"
                      >
                        {status === 'submitting' ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('whitelist.submitting')}
                          </span>
                        ) : (
                          t('whitelist.submit')
                        )}
                      </PrimaryButton>
                    </div>
                  </div>
                </form>

                <p className="mt-4 text-[12px] text-muted-foreground/70">
                  {t('whitelist.microcopy')}
                </p>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </LandingLayout>
  );
}
