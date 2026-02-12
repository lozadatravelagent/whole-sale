import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "Pasamos de responder cotizaciones en horas a responder en minutos. El equipo trabaja más ordenado y el cliente lo percibe enseguida.",
    author: "María García",
    role: "Dueña de agencia",
    company: "Viajes Maravilla"
  },
  {
    quote: "Con las integraciones de mayoristas dejamos de saltar entre sistemas. Hoy cotizamos más rápido y con menos errores.",
    author: "Carlos Rodríguez",
    role: "Gerente comercial",
    company: "Turismo Total"
  },
  {
    quote: "Emilia le sacó presión al equipo en los horarios pico. Podemos atender más consultas sin perder calidad comercial.",
    author: "Laura Fernández",
    role: "CEO",
    company: "Destinos Premium"
  }
]

export function Testimonial() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const currentQuote = testimonials[currentIndex].quote
    let charIndex = 0
    setDisplayedText("")
    setIsTyping(true)

    intervalRef.current = setInterval(() => {
      if (charIndex < currentQuote.length) {
        setDisplayedText(currentQuote.slice(0, charIndex + 1))
        charIndex++
      } else {
        setIsTyping(false)
        if (intervalRef.current) clearInterval(intervalRef.current)

        // Wait 4 seconds then move to next testimonial
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % testimonials.length)
        }, 4000)
      }
    }, 30)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [currentIndex])

  const current = testimonials[currentIndex]

  return (
    <section className="py-20 md:py-24 bg-gradient-to-b from-[#0a0a0f] to-[#0d0d15] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            className="text-cyan-300 uppercase tracking-wider text-sm font-semibold mb-4"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Comentarios de agencias
          </motion.p>

          <motion.h3
            className="text-3xl md:text-4xl font-bold text-white mb-8"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            viewport={{ once: true }}
          >
            Lo que dicen equipos como el tuyo
          </motion.h3>

          {/* Quote icon */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-500/10 mb-10"
          >
            <Quote className="w-10 h-10 text-blue-400" />
          </motion.div>

          {/* Quote text with typing effect */}
          <div className="min-h-[140px] mb-10">
            <p className="text-2xl md:text-3xl lg:text-4xl text-white font-light leading-relaxed">
              &ldquo;{displayedText}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-[3px] h-8 bg-blue-400 ml-1 align-middle"
                />
              )}
              &rdquo;
            </p>
          </div>

          {/* Author */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
              {current.author.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="text-left">
              <div className="text-white font-medium text-lg">{current.author}</div>
              <div className="text-gray-500 text-base">{current.role}, {current.company}</div>
            </div>
          </motion.div>

          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-8 bg-blue-500'
                    : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
