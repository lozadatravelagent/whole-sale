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
    <section id="showcase" ref={containerRef} className="scroll-mt-28 md:scroll-mt-32 py-16 md:py-20 bg-transparent relative overflow-hidden">
      <div className="absolute inset-0 landing-section-scrim landing-section-scrim-strong" />
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
            Desde la consulta inicial hasta el cierre
          </h2>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto">
            Una vista de trabajo para cotizar, seguir oportunidades y mantener cada viaje bajo control.
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
              {/* Video area */}
              <video
                src="/promo.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
