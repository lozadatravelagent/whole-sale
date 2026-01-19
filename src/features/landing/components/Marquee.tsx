import { motion } from "framer-motion"

const integrations = [
  "EUROVIPS",
  "LOZADA",
  "DELFOS",
  "ICARO",
  "STARLING",
  "WhatsApp Business",
  "MercadoPago",
  "AFIP",
]

export function Marquee() {
  return (
    <section className="py-20 bg-[#0a0a0f] border-y border-white/[0.05] overflow-hidden">
      <div className="container mx-auto px-6 mb-10">
        <p className="text-center text-base text-gray-500 uppercase tracking-wider">
          Integrado con los principales mayoristas y servicios
        </p>
      </div>

      <div className="relative">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10" />

        {/* Marquee container */}
        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-12 items-center"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {/* Duplicate items for seamless loop */}
            {[...integrations, ...integrations].map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-8 py-4 bg-white/[0.03] border border-white/[0.08] rounded-full whitespace-nowrap hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-default"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-gray-400 font-medium text-lg">{name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
