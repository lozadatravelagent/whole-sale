import { useTranslation } from "react-i18next";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const Terms = () => {
  const { t } = useTranslation("pages");

  return (
    <PublicPageShell
      title={t("terms.title")}
      subtitle={t("terms.subtitle")}
      updatedAt={t("common.updatedAt")}
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("terms.section1.title")}</h2>
          <p className="text-gray-300 leading-relaxed">{t("terms.section1.body")}</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("terms.section2.title")}</h2>
          <p className="text-gray-300 leading-relaxed">{t("terms.section2.body")}</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("terms.section3.title")}</h2>
          <p className="text-gray-300 leading-relaxed">{t("terms.section3.body")}</p>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Terms;
