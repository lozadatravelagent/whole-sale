import { motion } from "framer-motion"
import { Compass, Handshake, ShieldCheck } from "lucide-react"

const values = [
  {
    icon: Compass,
    title: "Especialistas en turismo",
    description:
      "Entendemos el día a día de una agencia: cotizar rápido, ordenar operaciones y dar seguimiento comercial.",
  },
  {
    icon: Handshake,
    title: "Acompañamiento real",
    description:
      "No vendemos solo software. Te acompañamos en la implementación para que tu equipo adopte la herramienta sin fricción.",
  },
  {
    icon: ShieldCheck,
    title: "Confianza operativa",
    description:
      "Centralizamos información de clientes, ventas y proveedores para trabajar con más control y menos errores manuales.",
  },
]

export function AboutUs() {
  return (
    <section id="about" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-[#0a0a0f]/90 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <span className="inline-block text-blue-400 text-sm font-semibold tracking-wider uppercase mb-4">
            Quiénes somos
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
            Tecnología pensada para agencias de viajes
          </h2>
          <p className="text-lg md:text-xl text-gray-400">
            Nacimos para ayudar a empresas de turismo a vender mejor, ordenar su operación y responder a cada cliente con más velocidad y calidad.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {values.map((value, index) => (
            <motion.article
              key={value.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center mb-5">
                <value.icon className="w-6 h-6 text-blue-300" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-3">{value.title}</h3>
              <p className="text-gray-400 leading-relaxed">{value.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
