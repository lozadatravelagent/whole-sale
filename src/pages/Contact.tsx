import { useTranslation } from "react-i18next";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { salesEmail, salesWhatsAppDisplay, salesWhatsAppGeneralUrl } from "@/lib/contact-links";

const Contact = () => {
  const { t } = useTranslation("pages");

  return (
    <PublicPageShell
      title={t("contact.title")}
      subtitle={t("contact.subtitle")}
      updatedAt={t("common.updatedAt")}
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("contact.channels.title")}</h2>
          <ul className="space-y-3 text-gray-300">
            <li>
              {t("contact.channels.email")}{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href={`mailto:${salesEmail}`}>
                {salesEmail}
              </a>
            </li>
            <li>
              {t("contact.channels.whatsapp")}{" "}
              <a
                className="text-emerald-300 hover:text-emerald-200"
                href={salesWhatsAppGeneralUrl}
                target="_blank"
                rel="noreferrer"
              >
                {salesWhatsAppDisplay}
              </a>
            </li>
            <li>{t("contact.channels.responseTime")}</li>
            <li>{t("contact.channels.implementation")}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">{t("contact.next.title")}</h2>
          <p className="text-gray-300 leading-relaxed mb-4">{t("contact.next.body")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={salesWhatsAppGeneralUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors"
            >
              {t("contact.next.writeWhatsapp")}
            </a>
            <a
              href="https://app.vibook.ai/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
            >
              {t("contact.next.login")}
            </a>
          </div>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Contact;
