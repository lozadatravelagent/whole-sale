import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  Plane,
  DollarSign,
  Bot,
  MessageCircle,
  Calendar,
  Bell,
  FileText,
  TrendingUp
} from "lucide-react"

const features = [
  {
    icon: LayoutDashboard,
    title: "Panel de gestión",
    description: "Ventas, oportunidades y tareas en una sola vista.",
  },
  {
    icon: Users,
    title: "Clientes centralizados",
    description: "Historial de viajes, preferencias y seguimiento comercial.",
  },
  {
    icon: Plane,
    title: "Operación de viajes",
    description: "Control de pasajeros, fechas, servicios y documentación.",
  },
  {
    icon: DollarSign,
    title: "Finanzas y caja",
    description: "Ingresos, egresos y control diario de cada venta.",
  },
  {
    icon: Bot,
    title: "Emilia asistente",
    description: "Te ayuda a responder, cotizar y avanzar oportunidades.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp integrado",
    description: "Atención comercial en el canal que ya usa tu cliente.",
  },
  {
    icon: Calendar,
    title: "Calendario",
    description: "Fechas de salida, regreso y pendientes de equipo.",
  },
  {
    icon: Bell,
    title: "Alertas",
    description: "Recordatorios de cobros, vencimientos y acciones urgentes.",
  },
  {
    icon: FileText,
    title: "Embudo comercial",
    description: "Seguimiento de leads por etapa y probabilidad de cierre.",
  },
  {
    icon: TrendingUp,
    title: "Reportes",
    description: "Métricas de rendimiento para decidir con datos reales.",
  }
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-transparent relative overflow-hidden">
      {/* Travel background image */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')" }}
        />
        <div className="absolute inset-0 bg-[#0a0a0f]/85" />
      </div>

      {/* Background elements */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl z-[1]" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl z-[1]" />

      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.span
            className="inline-block text-blue-400 text-sm font-medium tracking-wider uppercase mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
          >
            Funcionalidades
          </motion.span>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Lo esencial para vender mejor
          </h2>
          <p className="text-2xl md:text-3xl text-gray-400 max-w-2xl mx-auto">
            Un sistema completo diseñado para agencias de viajes
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group relative"
            >
              <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 h-full backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300">
                {/* Gradient glow on hover - unified blue/cyan */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-[0.08] rounded-2xl transition-opacity duration-300" />

                {/* Icon - unified blue/cyan */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
