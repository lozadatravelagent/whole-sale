import { motion } from "framer-motion"
import { Building2, CheckCircle2, PlugZap } from "lucide-react"

const wholesalePartners = [
  "EUROVIPS",
  "LOZADA",
  "DELFOS",
  "ICARO",
  "STARLING",
]

const servicePartners = [
  "WhatsApp Business",
  "Mercado Pago",
  "AFIP",
  "PDF Automation",
  "Reportes de gestión",
]

const keyBenefits = [
  "Menos tareas manuales",
  "Seguimiento comercial",
  "Operación centralizada",
  "Reportes claros para decidir",
]

export function Integrations() {
  return (
    <section id="integrations" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-[#0a0a0f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-12 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-12 right-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <span className="inline-block text-cyan-300 text-sm font-semibold tracking-wider uppercase mb-4">
            Integraciones
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
            Integraciones listas para la operación real
          </h2>
          <p className="text-lg md:text-xl text-gray-400">
            Conectá mayoristas y servicios clave para trabajar con más velocidad, control y menos tareas manuales.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
          <motion.article
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 md:p-8 transition-all hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h3 className="text-white text-xl font-semibold">Mayoristas compatibles</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Conexiones para trabajar con los proveedores más usados del sector.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wholesalePartners.map((partner) => (
                <div
                  key={partner}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-cyan-400/30 transition-colors"
                >
                  <p className="text-sm font-semibold text-white">{partner}</p>
                  <div className="flex items-center gap-1.5 text-xs text-cyan-200 mt-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Compatible</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 md:p-8 transition-all hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                <PlugZap className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h3 className="text-white text-xl font-semibold">Servicios compatibles para operar mejor</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Herramientas clave para cobros, comunicación y gestión diaria.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {servicePartners.map((partner) => (
                <div
                  key={partner}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-cyan-400/30 transition-colors"
                >
                  <p className="text-sm font-semibold text-white">{partner}</p>
                  <div className="flex items-center gap-1.5 text-xs text-cyan-200 mt-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Compatible</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.article>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {keyBenefits.map((item) => (
              <span
                key={item}
                className="px-4 py-2 rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-200 text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
