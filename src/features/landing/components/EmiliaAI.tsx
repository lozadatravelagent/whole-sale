import { motion } from "framer-motion"
import { Bot, Sparkles, MessageSquare, Zap, Search, FileText } from "lucide-react"

export function EmiliaAI() {
  return (
    <section id="emilia" className="py-32 bg-gradient-to-b from-[#0a0a0f] via-[#0a0a1a] to-[#0a0a0f] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[150px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Floating particles */}
      <motion.div
        className="absolute top-32 left-1/4 w-2 h-2 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"
        animate={{ y: [0, -30, 0], opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-32 right-1/3 w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
        animate={{ y: [0, 20, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1 }}
      />
      <motion.div
        className="absolute top-1/2 right-1/4 w-2 h-2 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50"
        animate={{ x: [0, 15, 0], opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, delay: 2 }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Potenciado por IA</span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Conoce a
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"> Emilia</span>
            </h2>

            <p className="text-xl md:text-2xl text-gray-400 mb-10 leading-relaxed">
              Tu asistente de inteligencia artificial que cotiza, busca y genera propuestas automaticamente.
              Trabaja mas rapido que nunca.
            </p>

            {/* Features */}
            <div className="space-y-6">
              {[
                { icon: Search, title: "Busqueda inteligente", desc: "Encuentra vuelos, hoteles y paquetes en segundos" },
                { icon: MessageSquare, title: "Chat natural", desc: "Conversa como si fuera una persona de tu equipo" },
                { icon: FileText, title: "Propuestas automaticas", desc: "Genera PDFs profesionales listos para enviar" },
                { icon: Zap, title: "Respuestas instantaneas", desc: "Nunca mas hagas esperar a un cliente" }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-lg mb-1">{feature.title}</h4>
                    <p className="text-gray-500 text-base">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Chat preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
              {/* Chat header */}
              <div className="flex items-center gap-4 pb-5 border-b border-white/10 mb-5">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0a0a0f]" />
                </div>
                <div>
                  <div className="text-white font-semibold text-lg">Emilia</div>
                  <div className="text-sm text-green-400 flex items-center gap-1">
                    En linea
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-5 min-h-[320px]">
                {/* User message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  viewport={{ once: true }}
                  className="flex justify-end"
                >
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl rounded-br-md px-5 py-4 max-w-[85%]">
                    <p className="text-white text-base">Necesito un vuelo para 2 personas a Madrid, saliendo el 15 de marzo</p>
                  </div>
                </motion.div>

                {/* AI response */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  viewport={{ once: true }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-5 py-4 max-w-[90%]">
                    <p className="text-gray-300 text-base mb-4">Encontre varias opciones! Aca tenes las mejores:</p>

                    {/* Flight cards */}
                    <div className="space-y-3">
                      {[
                        { airline: "Iberia", price: "$1,245", duration: "12h 30m", stops: "Directo" },
                        { airline: "Air Europa", price: "$1,180", duration: "13h 15m", stops: "1 escala" }
                      ].map((flight, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 + i * 0.15 }}
                          viewport={{ once: true }}
                          className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium text-base">{flight.airline}</div>
                              <div className="text-gray-500 text-sm">{flight.duration} - {flight.stops}</div>
                            </div>
                            <div className="text-green-400 font-bold text-xl">{flight.price}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <p className="text-gray-400 text-sm mt-4">Queres que arme la propuesta con alguna de estas opciones?</p>
                  </div>
                </motion.div>

                {/* Typing indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  viewport={{ once: true }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Input */}
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-white/5 rounded-xl px-5 py-4 text-gray-500 text-base border border-white/10">
                    Escribi un mensaje...
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity shadow-lg shadow-purple-500/25">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <motion.div
              className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-3xl blur-2xl"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-3xl blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
