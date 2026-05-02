import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const Documentation = () => {
  const { t } = useTranslation("pages");

  const sections = [
    {
      title: t("documentation.sections.gettingStarted.title"),
      items: t("documentation.sections.gettingStarted.items", { returnObjects: true }) as string[],
    },
    {
      title: t("documentation.sections.dailyOps.title"),
      items: t("documentation.sections.dailyOps.items", { returnObjects: true }) as string[],
    },
    {
      title: t("documentation.sections.quickResources.title"),
      items: t("documentation.sections.quickResources.items", { returnObjects: true }) as string[],
    },
  ];

  return (
    <PublicPageShell
      title={t("documentation.title")}
      subtitle={t("documentation.subtitle")}
      updatedAt={t("common.updatedAt")}
    >
      <div className="space-y-8">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
            <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li key={item} className="text-gray-300 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-6">
          <p className="text-cyan-100">
            {t("documentation.helpPrefix")}{" "}
            <Link to="/soporte" className="underline">{t("documentation.supportLink")}</Link>{" "}
            {t("documentation.or")}{" "}
            <Link to="/contacto" className="underline">{t("documentation.salesLink")}</Link>
            {t("documentation.helpSuffix")}
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
};

export default Documentation;
