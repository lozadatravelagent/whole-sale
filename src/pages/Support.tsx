import { useTranslation } from "react-i18next";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const Support = () => {
  const { t } = useTranslation("pages");
  const checklistItems = t("support.checklist.items", { returnObjects: true }) as string[];

  return (
    <PublicPageShell
      title={t("support.title")}
      subtitle={t("support.subtitle")}
      updatedAt={t("common.updatedAt")}
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("support.channels.title")}</h2>
          <ul className="space-y-3 text-gray-300">
            <li>
              {t("support.channels.general")}{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href="mailto:soporte@vibook.ai">
                soporte@vibook.ai
              </a>
            </li>
            <li>
              {t("support.channels.sales")}{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href="mailto:ventas@vibook.ai">
                ventas@vibook.ai
              </a>
            </li>
            <li>{t("support.channels.hours")}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("support.checklist.title")}</h2>
          <ul className="space-y-3 text-gray-300">
            {checklistItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Support;
