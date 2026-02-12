import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public/PublicPageShell";

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
              <a className="text-cyan-300 hover:text-cyan-200" href="mailto:ventas@vibook.ai">
                ventas@vibook.ai
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
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
          >
            Iniciar sesión
          </Link>
        </article>
      </div>
    </PublicPageShell>
  );
};

export default Contact;
