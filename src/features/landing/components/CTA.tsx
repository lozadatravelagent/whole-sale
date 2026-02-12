import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Check } from "lucide-react"

const benefits = [
  "7 días de prueba gratis",
  "Sin tarjeta de crédito",
  "Soporte personalizado",
  "Implementación guiada"
]

export function CTA() {
  const navigate = useNavigate()

  return (
    <section id="cta" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-[#0a0a0f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[200px]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          {/* Main CTA card */}
          <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-10 md:p-16 text-center backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Animated border gradient */}
            <div className="absolute inset-0 rounded-3xl">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 opacity-50" />
            </div>

            {/* Floating particles */}
            <motion.div
              className="absolute top-8 left-8 w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
              animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute top-12 right-12 w-3 h-3 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"
              animate={{ y: [0, 15, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            />
            <motion.div
              className="absolute bottom-16 left-16 w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"
              animate={{ x: [0, 10, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute bottom-12 right-16 w-2.5 h-2.5 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50"
              animate={{ y: [0, -12, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 4.5, repeat: Infinity, delay: 2 }}
            />

            <div className="relative z-10">
              <motion.h2
                className="text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                Listo para transformar
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  tu agencia?
                </span>
              </motion.h2>

              <motion.p
                className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
              >
                Sumate a las agencias que ya están vendiendo mejor con Vibook
              </motion.p>

              {/* Benefits */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-10"
              >
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-base">{benefit}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
              >
                <button
                  onClick={() => navigate('/login')}
                  className="group inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-12 py-6 text-xl rounded-xl font-medium shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
                >
                  Probar 7 días gratis
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="text-gray-500 text-sm mt-6"
              >
                Configuración en minutos - Sin compromiso - Cancelá cuando quieras
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
