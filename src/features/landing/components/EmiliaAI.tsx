import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Bot, MessageSquare, Send, Sparkles } from "lucide-react"

type ChatRole = "user" | "assistant"

interface ChatMessage {
  id: number
  role: ChatRole
  text: string
}

const quickPrompts = [
  "Busco paquete al Caribe para 2 adultos en abril",
  "Necesito vuelo + hotel para Bariloche en julio",
  "Quiero opciones familiares para Brasil",
]

function buildResponse(prompt: string): string {
  const normalized = prompt.toLowerCase()

  if (normalized.includes("caribe")) {
    return "Perfecto. Te preparé una propuesta Caribe con vuelo + hotel, opciones all inclusive y diferencias de tarifa por categoría. Si querés, te la ordeno por presupuesto para cerrar más rápido."
  }

  if (normalized.includes("bariloche")) {
    return "Listo. Encontré alternativas para Bariloche con salida en julio, incluyendo opciones con equipaje y diferentes horarios. También puedo sumar traslados y asistencia para enviar una propuesta completa."
  }

  if (normalized.includes("brasil")) {
    return "Excelente elección. Te armé opciones para Brasil orientadas a viaje familiar, con hoteles bien ubicados y propuestas fáciles de comparar para tu cliente."
  }

  return "¡Recibido! Ya estoy armando una propuesta con opciones claras para que puedas responder al cliente sin perder tiempo."
}

export function EmiliaAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hola, soy Emilia. Contame qué viaje te pidió tu cliente y te ayudo a cotizarlo.",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const messageIdRef = useRef(2)
  const intervalRef = useRef<number | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  const canSend = inputValue.trim().length > 0 && !isTyping

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, isTyping])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [])

  const appendAssistantWithTyping = (text: string) => {
    const assistantId = messageIdRef.current++

    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }])
    setIsTyping(true)

    let charIndex = 0
    intervalRef.current = window.setInterval(() => {
      charIndex += 1
      const partial = text.slice(0, charIndex)

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, text: partial } : message
        )
      )

      if (charIndex >= text.length) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setIsTyping(false)
      }
    }, 18)
  }

  const handleSend = (text: string) => {
    const cleanText = text.trim()
    if (!cleanText || isTyping) return

    const userId = messageIdRef.current++
    setMessages((prev) => [...prev, { id: userId, role: "user", text: cleanText }])
    setInputValue("")

    const response = buildResponse(cleanText)
    window.setTimeout(() => appendAssistantWithTyping(response), 450)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSend(inputValue)
  }

  const featureBullets = useMemo(
    () => [
      "Responde consultas de clientes en segundos.",
      "Sugiere opciones de viaje claras para vender mejor.",
      "Ayuda a preparar propuestas listas para enviar.",
      "Mantiene al equipo alineado y con seguimiento comercial.",
    ],
    []
  )

  return (
    <section id="emilia" className="scroll-mt-28 md:scroll-mt-32 py-20 md:py-24 bg-gradient-to-b from-[#0a0a0f] via-[#0b0f1a] to-[#0a0a0f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[440px] h-[440px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[360px] h-[360px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-7">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-sm text-blue-200">Asistente comercial</span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5">
              Emilia, tu apoyo para vender más
            </h2>
            <p className="text-lg md:text-xl text-gray-400 mb-8 leading-relaxed">
              Emilia acompaña a tu equipo durante la atención comercial para responder más rápido y cerrar oportunidades sin perder calidad.
            </p>

            <ul className="space-y-3">
              {featureBullets.map((item) => (
                <li key={item} className="text-gray-300 flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-sm p-5 md:p-6 shadow-2xl">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">Emilia</p>
                  <p className="text-xs text-green-400">En línea</p>
                </div>
              </div>

              <div
                ref={messagesContainerRef}
                className="mt-4 h-[320px] overflow-y-auto space-y-3 pr-1"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                        message.role === "user"
                          ? "bg-blue-500/20 border border-blue-400/30 text-gray-100 rounded-br-md"
                          : "bg-white/[0.08] border border-white/10 text-gray-200 rounded-bl-md"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.08] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:120ms]" />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      disabled={isTyping}
                      className="text-xs md:text-sm px-3 py-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MessageSquare className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder="Escribe una consulta de cliente..."
                      className="w-full h-11 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="h-11 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
