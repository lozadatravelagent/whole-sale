import { motion } from "framer-motion"
import {
  Users,
  Plane,
  DollarSign,
  FileText,
  BarChart3,
  Link2,
  ShoppingCart
} from "lucide-react"
import { Card3D } from "./Card3D"

const modules = [
  {
    icon: Users,
    title: "Clientes",
    features: ["Base de datos completa", "Historial de viajes", "Documentos asociados", "Segmentación avanzada"],
  },
  {
    icon: Plane,
    title: "Operaciones",
    features: ["Gestión de viajes", "Pasajeros y documentos", "Pagos y comisiones", "Estados automáticos"],
  },
  {
    icon: ShoppingCart,
    title: "CRM",
    features: ["Pipeline visual", "Seguimiento de leads", "Conversión automática", "Métricas de venta"],
  },
  {
    icon: DollarSign,
    title: "Finanzas",
    features: ["Control de caja", "Ingresos y egresos", "Conciliación bancaria", "Reportes financieros"],
  },
  {
    icon: BarChart3,
    title: "Reportes",
    features: ["KPI comerciales", "Evolución de ventas", "Rendimiento por vendedor", "Tableros accionables"],
  },
  {
    icon: Link2,
    title: "Integraciones",
    features: ["Mayoristas compatibles", "Conexiones por credenciales", "Marketplace de proveedores", "Estado de integraciones"],
  }
]

export function Modules() {
  return (
    <section id="modules" className="scroll-mt-28 md:scroll-mt-32 py-16 md:py-20 bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
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
            Módulos
          </motion.span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Módulos que trabajan juntos
          </h2>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto">
            Todo lo que tu agencia necesita, funcionando de forma integrada y simple para el equipo.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card3D>
                <div className="relative h-full bg-white/[0.02] border border-blue-500/20 hover:border-blue-500/40 rounded-2xl p-10 transition-all duration-300 overflow-hidden group">
                  {/* Gradient overlay on hover - unified blue/cyan */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

                  {/* Header */}
                  <div className="flex items-center gap-4 mb-8 relative z-10">
                    <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <module.icon className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{module.title}</h3>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 relative z-10">
                    {module.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-base">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card3D>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
