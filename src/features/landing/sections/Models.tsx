import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '../components/SectionHeading';

const TAB_KEYS = ['saas', 'embedded', 'api'] as const;

export function Models() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const handleStartChat = () => navigate('/emilia/chat');

  return (
    <motion.section
      id="models"
      aria-labelledby="models-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="models-heading"
          eyebrow={t('models.eyebrow')}
          title={t('models.headline')}
          subtitle={t('models.subheadline')}
          align="center"
          className="mb-12 lg:mb-14"
        />
        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="saas" className="flex flex-col gap-8">
            <TabsList className="mx-auto grid w-full max-w-md grid-cols-3">
              {TAB_KEYS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {t(`models.tabs.${key}.label`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {TAB_KEYS.map((key) => (
              <TabsContent key={key} value={key} className="mt-0">
                <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    {t(`models.tabs.${key}.title`)}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {t(`models.tabs.${key}.copy`)}
                  </p>
                  <div className="mt-6">
                    <Button onClick={handleStartChat} size="sm">
                      {t('navbar.primaryCta')}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </motion.section>
  );
}
