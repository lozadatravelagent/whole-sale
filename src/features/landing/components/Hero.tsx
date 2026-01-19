import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Play } from "lucide-react"
import { MagneticButton } from "./MagneticButton"
import { TextScramble } from "./TextScramble"

export function Hero() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0f] pt-20">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Floating elements */}
      <motion.div
        className="absolute top-32 left-[15%] w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
        animate={{
          y: [0, -25, 0],
          opacity: [0.4, 1, 0.4],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-48 right-[20%] w-2 h-2 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"
        animate={{
          y: [0, 30, 0],
          opacity: [0.3, 1, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-48 left-[20%] w-4 h-4 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"
        animate={{
          y: [0, -35, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute bottom-36 right-[15%] w-2.5 h-2.5 bg-blue-300 rounded-full shadow-lg shadow-blue-300/50"
        animate={{
          x: [0, 20, 0],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[60%] left-[10%] w-2 h-2 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50"
        animate={{
          y: [0, 20, 0],
          x: [0, 10, 0],
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Floating card elements */}
      <motion.div
        className="absolute top-[30%] left-[8%] hidden lg:block"
        animate={{ y: [0, -15, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xl">$</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Ventas del mes</div>
              <div className="text-white font-bold text-lg">$245,890</div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute top-[25%] right-[8%] hidden lg:block"
        animate={{ y: [0, 20, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xl">&#9992;</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Operaciones activas</div>
              <div className="text-white font-bold text-lg">156</div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-[25%] right-[12%] hidden lg:block"
        animate={{ y: [0, -20, 0], rotate: [-1, 3, -1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xl">&#128101;</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Clientes nuevos</div>
              <div className="text-white font-bold text-lg">+23 esta semana</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Badge with scramble effect */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-white/[0.08] to-white/[0.03] border border-white/10 backdrop-blur-sm mb-8 shadow-lg"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <TextScramble
              text="Sistema de Gestion para Agencias de Viajes"
              className="text-sm text-gray-300"
              delay={500}
            />
          </motion.div>

          {/* Main Title */}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-8">
            <motion.span
              className="text-white block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Toda tu <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">AGENCIA</span>
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent block mt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              en un solo lugar
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Vibook es el sistema de gestion mas completo para agencias de viajes.
            Gestiona clientes, operaciones, finanzas, CRM y mas con inteligencia artificial.
          </motion.p>

          {/* CTAs with magnetic effect */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <MagneticButton onClick={() => navigate('/login')}>
              <span className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-4 text-lg rounded-xl font-medium shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300">
                Comenzar gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </MagneticButton>
            <MagneticButton>
              <button
                onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}
                className="group inline-flex items-center gap-2 text-gray-300 hover:text-white px-6 py-4 text-lg transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
                Ver demo
              </button>
            </MagneticButton>
          </motion.div>

          {/* Stats with counter animation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-xl mx-auto"
          >
            {[
              { value: "500+", label: "Operaciones/mes" },
              { value: "50+", label: "Agencias activas" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.1 }}
              >
                <div className="text-4xl md:text-5xl font-bold text-white">{stat.value}</div>
                <div className="text-base text-gray-500 mt-2">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/50 to-transparent" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
          <motion.div
            className="w-1.5 h-1.5 bg-white/50 rounded-full"
            animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  )
}
