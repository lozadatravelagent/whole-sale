import { PublicPageShell } from "@/components/public/PublicPageShell";

const Support = () => {
  return (
    <PublicPageShell
      title="Soporte"
      subtitle="Canales de contacto para implementación, incidencias y consultas operativas."
      updatedAt="12 de febrero de 2026"
    >
      <div className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">Canales disponibles</h2>
          <ul className="space-y-3 text-gray-300">
            <li>
              Soporte general:{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href="mailto:soporte@vibook.ai">
                soporte@vibook.ai
              </a>
            </li>
            <li>
              Ventas e implementación:{" "}
              <a className="text-cyan-300 hover:text-cyan-200" href="mailto:ventas@vibook.ai">
                ventas@vibook.ai
              </a>
            </li>
            <li>Horario de atención: lunes a viernes, 9:00 a 18:00 (GMT-3).</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
          <h2 className="text-2xl font-semibold mb-4">Qué incluir en tu consulta</h2>
          <ul className="space-y-3 text-gray-300">
            <li>Nombre de la agencia y usuario afectado.</li>
            <li>Módulo o pantalla involucrada.</li>
            <li>Captura de pantalla o descripción paso a paso.</li>
            <li>Resultado esperado y resultado actual.</li>
          </ul>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Support;
