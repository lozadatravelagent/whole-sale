import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navigation } from "@/features/landing/components/Navigation";
import { EmiliaAI } from "@/features/landing/components/EmiliaAI";
import { Footer } from "@/features/landing/components/Footer";
import { ArrowRight, Sparkles } from "lucide-react";

export default function EmiliaLanding() {
  const { t } = useTranslation('landing');

  return (
    <div className="min-h-screen bg-[#040814] text-white">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[160px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[140px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-sky-200" />
            <span className="text-sm text-sky-100">{t('hero.badge')}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            {t('hero.titlePrefix')}{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent">
              {t('hero.titleHighlight')}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/emilia/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('hero.cta')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/emilia/login"
              className="text-sm text-sky-200 hover:text-white transition-colors"
            >
              {t('hero.loginLink')}
            </Link>
          </div>
        </div>
      </section>

      {/* Demo interactivo */}
      <EmiliaAI />

      {/* CTA final */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/8 rounded-full blur-[180px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-5">
            {t('cta.title')}
          </h2>
          <p className="text-lg text-gray-400 mb-8 leading-relaxed">
            {t('cta.description')}
          </p>
          <Link
            to="/emilia/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-6 py-3 text-base font-semibold hover:bg-gray-100 transition-colors"
          >
            {t('cta.button')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
