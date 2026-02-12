import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import { useState } from "react"

const plans = [
  {
    name: "Starter",
    description: "Para agencias pequeñas que están ordenando su operación",
    monthlyPrice: 79999,
    annualPrice: 79999,
    features: [
      "1 usuario",
      "100 conversaciones/mes",
      "50 cotizaciones asistidas",
      "Integración con 1 mayorista",
      "Chat web",
      "Soporte por email",
    ],
    color: "gray",
    popular: false
  },
  {
    name: "Professional",
    description: "Para equipos comerciales en crecimiento",
    monthlyPrice: 99999,
    annualPrice: 99999,
    features: [
      "Hasta 5 usuarios",
      "Conversaciones ilimitadas",
      "500 cotizaciones asistidas/mes",
      "Integración con 3 mayoristas",
      "WhatsApp + Chat web",
      "CRM completo",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    color: "blue",
    popular: true
  },
  {
    name: "Enterprise",
    description: "Para operaciones de gran volumen",
    monthlyPrice: 0,
    annualPrice: 0,
    customPrice: "Contactar",
    features: [
      "Usuarios ilimitados",
      "Todo ilimitado",
      "Cotizaciones asistidas ilimitadas",
      "Escalado de integraciones",
      "Multi-tenancy",
      "Acceso API",
      "Onboarding guiado",
      "Soporte dedicado",
      "SLA opcional (según contrato)",
    ],
    color: "purple",
    popular: false
  }
]

export function Pricing() {
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(true)
  const formatPrice = (value: number) => new Intl.NumberFormat("es-AR").format(value)

  const handlePlanCTA = (planName: string) => {
    if (planName === "Enterprise") {
      navigate('/contacto')
      return
    }

    navigate('/login')
  }

  return (
    <section id="pricing" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-block text-green-400 text-sm font-medium tracking-wider uppercase mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
          >
            Precios
          </motion.span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Planes pensados para agencias reales
          </h2>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10">
            Elegí el plan que mejor se adapta al tamaño de tu equipo
          </p>
          <p className="text-sm md:text-base text-cyan-300 mb-8">
            Todos los planes incluyen prueba de 7 días gratis
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm transition-colors ${!isAnnual ? 'text-white' : 'text-gray-500'}`}>
              Mensual
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isAnnual ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                animate={{ left: isAnnual ? '32px' : '4px' }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-sm transition-colors flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-gray-500'}`}>
              Anual
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">
                -20%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative group ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-3 h-3" />
                    Más popular
                  </div>
                </div>
              )}

              <div className={`h-full rounded-2xl p-10 transition-all duration-300 ${
                plan.popular
                  ? 'bg-gradient-to-b from-blue-500/10 to-transparent border-2 border-blue-500/30 hover:border-blue-500/50 shadow-xl shadow-blue-500/10'
                  : 'bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04]'
              }`}>
                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-base text-gray-500">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">
                      {plan.customPrice
                        ? plan.customPrice
                        : `$${formatPrice(isAnnual ? plan.annualPrice : plan.monthlyPrice)}`}
                    </span>
                    {!plan.customPrice && <span className="text-gray-500 text-lg">/mes</span>}
                  </div>
                  {isAnnual && !plan.customPrice && (
                    <p className="text-base text-gray-500 mt-1">
                      Facturación anual
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handlePlanCTA(plan.name)}
                  className={`block w-full py-4 text-center text-lg rounded-xl font-medium transition-all mb-8 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'Hablar con ventas' : 'Probar 7 días gratis'}
                </button>

                {/* Features */}
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-base">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        plan.popular ? 'bg-blue-500/20' : 'bg-white/10'
                      }`}>
                        <Check className={`w-4 h-4 ${plan.popular ? 'text-blue-400' : 'text-gray-400'}`} />
                      </div>
                      <span className="text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center text-gray-500 text-sm mt-12"
        >
          7 días de prueba gratis en todos los planes - Sin tarjeta de crédito - Cancelá cuando quieras
        </motion.p>
      </div>
    </section>
  )
}
