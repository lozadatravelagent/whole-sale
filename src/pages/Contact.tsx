import { PublicPageShell } from "@/components/public/PublicPageShell";
import { salesEmail, salesWhatsAppDisplay, salesWhatsAppGeneralUrl } from "@/lib/contact-links";

const Contact = () => {
  return (
    <PublicPageShell
      title="Contacto comercial"
      subtitle="Coordiná una demo o resolvé dudas sobre planes, implementación e integraciones."
      updatedAt="12 de febrero de 2026"
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">Canales de ventas</h2>
          <ul className="space-y-3 text-gray-300">
            <li>
              Email comercial:{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href={`mailto:${salesEmail}`}>
                {salesEmail}
              </a>
            </li>
            <li>
              WhatsApp comercial:{" "}
              <a
                className="text-emerald-300 hover:text-emerald-200"
                href={salesWhatsAppGeneralUrl}
                target="_blank"
                rel="noreferrer"
              >
                {salesWhatsAppDisplay}
              </a>
            </li>
            <li>Tiempo de respuesta estimado: 1 día hábil.</li>
            <li>Implementación guiada para agencias y equipos comerciales.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">Próximo paso recomendado</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Si ya tenés acceso, podés iniciar sesión y revisar el producto desde adentro.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={salesWhatsAppGeneralUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors"
            >
              Escribir por WhatsApp
            </a>
            <a
              href="https://app.vibook.ai/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
            >
              Iniciar sesión
            </a>
          </div>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Contact;
