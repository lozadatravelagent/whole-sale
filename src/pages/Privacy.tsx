import { useTranslation } from "react-i18next";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const Privacy = () => {
  const { t } = useTranslation("pages");

  return (
    <PublicPageShell
      title={t("privacy.title")}
      subtitle={t("privacy.subtitle")}
      updatedAt={t("common.updatedAt")}
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("privacy.section1.title")}</h2>
          <p className="text-gray-300 leading-relaxed">{t("privacy.section1.body")}</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("privacy.section2.title")}</h2>
          <p className="text-gray-300 leading-relaxed">{t("privacy.section2.body")}</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("privacy.section3.title")}</h2>
          <p className="text-gray-300 leading-relaxed">
            {t("privacy.section3.bodyPrefix")}{" "}
            <a className="text-cyan-300 hover:text-cyan-200" href="mailto:soporte@vibook.ai">
              soporte@vibook.ai
            </a>
            {t("privacy.section3.bodySuffix")}
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Privacy;
