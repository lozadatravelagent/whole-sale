import { PublicPageShell } from "@/components/public/PublicPageShell";

const Terms = () => {
  return (
    <PublicPageShell
      title="Términos de servicio"
      subtitle="Condiciones generales de uso de la plataforma Vibook."
      updatedAt="12 de febrero de 2026"
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">1. Alcance del servicio</h2>
          <p className="text-gray-300 leading-relaxed">
            Vibook ofrece herramientas de gestión comercial y operativa para agencias de viajes. El acceso puede variar
            según el plan contratado y configuración del mayorista o agencia.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">2. Responsabilidad de uso</h2>
          <p className="text-gray-300 leading-relaxed">
            Cada cuenta es responsable por el uso de sus credenciales, la veracidad de la información cargada y el
            cumplimiento de la normativa aplicable a su operación comercial y fiscal.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">3. Soporte y disponibilidad</h2>
          <p className="text-gray-300 leading-relaxed">
            Los niveles de soporte y disponibilidad pueden depender del plan contratado y de acuerdos comerciales
            específicos. Para condiciones particulares, contactá al equipo comercial.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Terms;
