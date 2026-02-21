import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

export function Showcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], [100, -100])

  return (
    <section id="showcase" ref={containerRef} className="scroll-mt-28 md:scroll-mt-32 py-16 md:py-20 bg-gradient-to-b from-[#0a0a0f]/90 via-[#0d0d15]/90 to-[#0a0a0f]/90 relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute inset-0"
        style={{ y }}
      >
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" />
      </motion.div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.span
            className="inline-block text-cyan-400 text-sm font-medium tracking-wider uppercase mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
          >
            Interfaz
          </motion.span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Diseñado para la operación diaria
          </h2>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto">
            Una interfaz clara para que tu equipo responda rápido y no pierda oportunidades.
          </p>
        </motion.div>

        {/* Main showcase */}
        <div className="relative">
          {/* Central large card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative mx-auto max-w-5xl"
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10">
              {/* Browser chrome */}
              <div className="bg-[#1a1a24] px-4 py-3 flex items-center gap-2 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-[#0d0d15] rounded-lg px-4 py-1.5 text-sm text-gray-500 text-center max-w-md mx-auto">
                    app.vibook.ai
                  </div>
                </div>
              </div>

              {/* Screenshot area */}
              <div className="aspect-[16/9] bg-gradient-to-br from-[#0d0d15] to-[#1a1a24] relative">
                {/* Placeholder content that looks like a dashboard */}
                <div className="absolute inset-0 p-6 md:p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500" />
                      <div>
                        <div className="h-4 w-32 bg-white/20 rounded" />
                        <div className="h-3 w-24 bg-white/10 rounded mt-2" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded-lg bg-white/5" />
                      <div className="w-10 h-10 rounded-lg bg-white/5" />
                    </div>
                  </div>

                  {/* Stats row - unified blue/cyan */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                    {[
                      { value: "$125,430", label: "Ventas" },
                      { value: "89", label: "Operaciones" },
                      { value: "156", label: "Clientes" },
                      { value: "23", label: "Pendientes" }
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        viewport={{ once: true }}
                        className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-5"
                      >
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 mb-3 md:mb-4" />
                        <div className="text-xl md:text-3xl font-bold text-white">{stat.value}</div>
                        <div className="text-sm text-gray-500">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Charts area */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div className="md:col-span-2 bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-6">
                      <div className="h-4 w-32 bg-white/20 rounded mb-4" />
                      {/* Fake chart */}
                      <div className="flex items-end gap-1 md:gap-2 h-24 md:h-32">
                        {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((height, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            whileInView={{ height: `${height}%` }}
                            transition={{ delay: 0.5 + i * 0.05 }}
                            viewport={{ once: true }}
                            className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t opacity-80"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-6 hidden md:block">
                      <div className="h-4 w-24 bg-white/20 rounded mb-4" />
                      {/* Fake list */}
                      {[1, 2, 3, 4].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-white/10" />
                          <div className="flex-1">
                            <div className="h-3 w-20 bg-white/20 rounded" />
                            <div className="h-2 w-14 bg-white/10 rounded mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Emilia quick preview inside interface */}
                <div className="absolute right-4 top-[110px] w-[250px] hidden lg:block z-10">
                  <div className="rounded-xl border border-white/15 bg-[#0e1019]/90 backdrop-blur-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-semibold">Emilia</span>
                      <span className="text-[11px] text-green-400">En línea</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="rounded-lg bg-blue-500/20 border border-blue-400/20 px-2.5 py-2 text-gray-100">
                        Cliente: ¿Tenés vuelo y hotel para Río?
                      </div>
                      <div className="rounded-lg bg-white/10 border border-white/10 px-2.5 py-2 text-gray-200">
                        Emilia: Sí, ya encontré opciones y te preparo la propuesta.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/50 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Floating badges - unified blue/cyan */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              viewport={{ once: true }}
              className="absolute left-4 top-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-5 py-3 rounded-lg shadow-lg shadow-blue-500/25 text-base font-medium hidden xl:block z-20"
            >
              +23% ventas este mes
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              viewport={{ once: true }}
              className="absolute right-4 bottom-8 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-5 py-3 rounded-lg shadow-lg shadow-blue-500/25 text-base font-medium hidden xl:block z-20"
            >
              156 operaciones activas
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
