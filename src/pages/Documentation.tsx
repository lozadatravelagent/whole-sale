import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const sections = [
  {
    title: "Primeros pasos",
    items: [
      "Crear usuarios y definir permisos por rol.",
      "Configurar agencia y branding base.",
      "Conectar proveedores desde Marketplace.",
    ],
  },
  {
    title: "Operación diaria",
    items: [
      "Gestionar leads en CRM y asignar responsables.",
      "Registrar operaciones y seguimiento comercial.",
      "Consultar reportes para detectar oportunidades.",
    ],
  },
  {
    title: "Recursos rápidos",
    items: [
      "Guías de onboarding para equipos nuevos.",
      "Buenas prácticas para seguimiento comercial.",
      "Checklist de implementación por agencia.",
    ],
  },
];

const Documentation = () => {
  return (
    <PublicPageShell
      title="Documentación"
      subtitle="Guía rápida para implementar Vibook y ordenar la operación comercial de tu agencia."
      updatedAt="12 de febrero de 2026"
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
            ¿Necesitás ayuda en la implementación? Visitá <Link to="/soporte" className="underline">Soporte</Link> o{" "}
            <Link to="/contacto" className="underline">contactá a ventas</Link>.
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
};

export default Documentation;
