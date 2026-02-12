import { PublicPageShell } from "@/components/public/PublicPageShell";

const Privacy = () => {
  return (
    <PublicPageShell
      title="Política de privacidad"
      subtitle="Cómo tratamos los datos de agencias, usuarios y operaciones dentro de Vibook."
      updatedAt="12 de febrero de 2026"
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">1. Datos que procesamos</h2>
          <p className="text-gray-300 leading-relaxed">
            Procesamos datos de identificación de usuarios, información operativa de agencias y registros de actividad
            necesarios para brindar el servicio y mejorar la experiencia de uso.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">2. Finalidad del tratamiento</h2>
          <p className="text-gray-300 leading-relaxed">
            Utilizamos la información para autenticación, operación funcional de la plataforma, soporte técnico y
            métricas agregadas de rendimiento del producto.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">3. Consultas y derechos</h2>
          <p className="text-gray-300 leading-relaxed">
            Para consultas sobre privacidad o solicitudes de acceso/actualización de datos, escribinos a{" "}
            <a className="text-cyan-300 hover:text-cyan-200" href="mailto:soporte@vibook.ai">
              soporte@vibook.ai
            </a>
            .
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Privacy;
