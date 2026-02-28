import { useEffect, useRef, useState } from "react"
import {
  motion,
  MotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"
import {
  ArrowDownRight,
  Bot,
  BriefcaseBusiness,
  Plane,
  Sparkles,
  Waves,
} from "lucide-react"
import { TravelRoutesScene } from "./TravelRoutesScene"
import { TravelRoutesFallback } from "./TravelRoutesFallback"
import { useIsMobile } from "@/hooks/use-mobile"

const highlights = [
  {
    icon: Plane,
    eyebrow: "Búsqueda conectada",
    title: "Vuelos, hoteles y paquetes en un solo flujo",
  },
  {
    icon: Bot,
    eyebrow: "Emilia en acción",
    title: "Respuestas más rápidas sin perder contexto comercial",
  },
  {
    icon: BriefcaseBusiness,
    eyebrow: "Operación clara",
    title: "Seguimiento, cobros y pendientes en una sola vista",
  },
]

const overlayCards = [
  {
    title: "Vuelo confirmado",
    detail: "EZE - CUN | 2 adultos",
    className: "left-4 top-24",
    x: [0, -48, -176],
    y: [0, -8, -62],
    rotate: [0, -5, -10],
    floatY: [0, -10, 0, 8, 0],
    floatRotate: [0, -1.6, 0, 1.1, 0],
    duration: 8.4,
    delay: 0.4,
  },
  {
    title: "Hotel cotizado",
    detail: "All inclusive | 7 noches",
    className: "right-4 top-28",
    x: [0, 42, 156],
    y: [0, -10, -78],
    rotate: [0, 5, 10],
    floatY: [0, 8, 0, -11, 0],
    floatRotate: [0, 1.4, 0, -1.2, 0],
    duration: 9.1,
    delay: 0.9,
  },
  {
    title: "Lead en seguimiento",
    detail: "Cliente pidió upgrade",
    className: "left-4 bottom-28",
    x: [0, -34, -142],
    y: [0, 18, 82],
    rotate: [0, -4, -9],
    floatY: [0, -7, 0, 10, 0],
    floatRotate: [0, -1.2, 0, 1.5, 0],
    duration: 8.8,
    delay: 0.2,
  },
  {
    title: "Cobro pendiente",
    detail: "Seña vence hoy 18:00",
    className: "right-4 bottom-20",
    x: [0, 38, 154],
    y: [0, 18, 78],
    rotate: [0, 4, 8],
    floatY: [0, 9, 0, -8, 0],
    floatRotate: [0, 1.1, 0, -1.4, 0],
    duration: 9.5,
    delay: 1.1,
  },
]

const metricRail = [
  { value: "+18%", label: "respuesta comercial" },
  { value: "32", label: "salidas activas" },
  { value: "84", label: "leads abiertos" },
  { value: "11", label: "cobros hoy" },
]

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

const supportsWebGL = () => {
  const canvas = document.createElement("canvas")
  return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
}

type OverlayCardConfig = (typeof overlayCards)[number]

function FloatingOverlayCard({
  card,
  progress,
}: {
  card: OverlayCardConfig
  progress: MotionValue<number>
}) {
  const x = useTransform(progress, [0, 0.45, 1], card.x)
  const y = useTransform(progress, [0, 0.45, 1], card.y)
  const rotate = useTransform(progress, [0, 0.45, 1], card.rotate)
  const opacity = useTransform(progress, [0, 0.8, 1], [0.96, 0.92, 0.2])
  const scale = useTransform(progress, [0, 0.65, 1], [1, 1.04, 0.88])

  return (
    <motion.div
      className={`landing-panel absolute max-w-[250px] rounded-[22px] px-4 py-3 ${card.className}`}
      style={{ x, y, rotate, opacity, scale }}
    >
      <motion.div
        animate={{
          y: card.floatY,
          rotate: card.floatRotate,
        }}
        transition={{
          duration: card.duration,
          delay: card.delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{card.title}</p>
        <p className="mt-1 text-sm font-semibold text-white">{card.detail}</p>
      </motion.div>
    </motion.div>
  )
}

export function LandingHero3D() {
  const sectionRef = useRef<HTMLElement>(null)
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()
  const [canRenderWebGL, setCanRenderWebGL] = useState(true)

  useEffect(() => {
    setCanRenderWebGL(supportsWebGL())
  }, [])

  const useFallback = isMobile || prefersReducedMotion || !canRenderWebGL
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })
  const progress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.32,
  })
  const contentY = useTransform(progress, [0, 0.6, 1], [0, -40, -170])
  const contentOpacity = useTransform(progress, [0, 0.72, 1], [1, 0.92, 0.22])
  const contentScale = useTransform(progress, [0, 1], [1, 0.9])
  const sceneScale = useTransform(progress, [0, 0.65, 1], [1, 1.08, 1.24])
  const sceneY = useTransform(progress, [0, 0.65, 1], [0, -16, -96])
  const sceneRotate = useTransform(progress, [0, 1], [0, -11])
  const haloScale = useTransform(progress, [0, 0.6, 1], [0.92, 1.12, 1.34])
  const innerHaloScale = useTransform(progress, [0, 1], [1, 1.18])
  const haloOpacity = useTransform(progress, [0, 0.4, 1], [0.28, 0.42, 0.12])
  const railY = useTransform(progress, [0, 0.35, 0.8], [110, 22, -20])
  const railOpacity = useTransform(progress, [0, 0.15, 0.85, 1], [0, 1, 0.78, 0.18])
  const ghostOneX = useTransform(progress, [0, 1], [-90, 140])
  const ghostTwoX = useTransform(progress, [0, 1], [150, -140])
  const ghostOpacity = useTransform(progress, [0, 0.45, 1], [0.08, 0.18, 0.04])
  const handoffY = useTransform(progress, [0.42, 0.8, 1], [170, 12, -26])
  const handoffOpacity = useTransform(progress, [0.42, 0.72, 1], [0, 1, 0.4])
  const cueOpacity = useTransform(progress, [0, 0.25, 0.5], [1, 0.7, 0])

  const sectionClassName = useFallback
    ? "relative overflow-hidden pb-20 pt-12 md:pb-24 md:pt-16"
    : "relative min-h-[230vh]"
  const stickyClassName = useFallback
    ? "relative overflow-hidden pb-20 pt-12 md:pb-24 md:pt-16"
    : "sticky top-0 flex h-screen items-center overflow-hidden"

  return (
    <section ref={sectionRef} className={sectionClassName}>
      <div className={stickyClassName}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[8%] top-12 h-56 w-56 rounded-full bg-cyan-500/[0.12] blur-[110px]" />
          <div className="absolute right-[12%] top-1/3 h-72 w-72 rounded-full bg-blue-500/14 blur-[140px]" />
          <div className="absolute bottom-8 left-1/3 h-64 w-64 rounded-full bg-amber-400/10 blur-[140px]" />
          {!useFallback && (
            <>
              <motion.div
                className="absolute left-[-8%] top-[18%] text-[18vw] font-black uppercase leading-none tracking-[-0.08em] text-white/10"
                style={{ x: ghostOneX, opacity: ghostOpacity }}
              >
                Search
              </motion.div>
              <motion.div
                className="absolute right-[-8%] top-[52%] text-[16vw] font-black uppercase leading-none tracking-[-0.08em] text-sky-200/10"
                style={{ x: ghostTwoX, opacity: ghostOpacity }}
              >
                Operate
              </motion.div>
            </>
          )}
        </div>

        <div className="container relative z-10 mx-auto px-6">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(460px,0.98fr)]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="max-w-2xl"
              style={
                useFallback
                  ? undefined
                  : { y: contentY, opacity: contentOpacity, scale: contentScale }
              }
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-100 shadow-[0_24px_80px_-48px_rgba(56,189,248,0.85)]">
                <Sparkles className="h-4 w-4" />
                Travel operations para agencias que venden con velocidad
              </div>

              <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
                Cotizá, seguí y operá cada viaje desde un mismo tablero.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 md:text-xl">
                Vibook conecta la consulta inicial, la búsqueda de servicios y el seguimiento comercial
                para que tu equipo responda más rápido sin perder control operativo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => scrollToSection("demo")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-amber-300 px-6 py-4 text-base font-semibold text-slate-950 shadow-[0_26px_70px_-36px_rgba(56,189,248,0.8)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  Proba emilia
                  <ArrowDownRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => scrollToSection("showcase")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/5 px-6 py-4 text-base font-semibold text-white transition-colors duration-300 hover:bg-white/10"
                >
                  Recorrer la interfaz
                </button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {highlights.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + index * 0.08, duration: 0.55 }}
                    className="landing-panel rounded-[24px] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-300/10 text-sky-100">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{item.eyebrow}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-white">{item.title}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {!useFallback && (
                <motion.div
                  className="mt-12 flex items-center gap-4 text-sm uppercase tracking-[0.28em] text-slate-400"
                  style={{ opacity: cueOpacity }}
                >
                  <span>Deslizá</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-sky-300/60 to-transparent" />
                  <div className="h-10 w-6 rounded-full border border-white/15 p-1">
                    <motion.div
                      className="h-2 w-2 rounded-full bg-sky-300"
                      animate={{ y: [0, 16, 0], opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.12 }}
              className="relative"
              style={useFallback ? undefined : { y: sceneY, scale: sceneScale, rotate: sceneRotate }}
            >
              {!useFallback && (
                <motion.div
                  className="absolute inset-[-10%] rounded-full border border-sky-300/10"
                  style={{ scale: haloScale, opacity: haloOpacity }}
                />
              )}
              {!useFallback && (
                <motion.div
                  className="absolute inset-[8%] rounded-full border border-cyan-200/10"
                  style={{ scale: innerHaloScale, opacity: haloOpacity }}
                />
              )}

              <div className="landing-panel relative min-h-[400px] overflow-hidden rounded-[32px] border border-white/[0.12] md:min-h-[560px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.3),rgba(2,6,23,0.65))]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.07)_1px,transparent_1px)] bg-[size:68px_68px] opacity-25" />

                {useFallback ? <TravelRoutesFallback /> : <TravelRoutesScene progress={progress} />}

                <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
                  {overlayCards.map((card) => (
                    <FloatingOverlayCard key={card.title} card={card} progress={progress} />
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:hidden">
                {overlayCards.map((card) => (
                  <div key={card.title} className="landing-panel rounded-[22px] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{card.title}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{card.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {!useFallback && (
            <>
              <motion.div
                className="pointer-events-none absolute inset-x-6 bottom-[8vh] z-20 hidden lg:grid lg:grid-cols-4"
                style={{ y: railY, opacity: railOpacity }}
              >
                {metricRail.map((item, index) => (
                  <div
                    key={item.label}
                    className={`border-t border-white/10 px-4 pt-5 ${index !== metricRail.length - 1 ? "border-r" : ""} border-white/10`}
                  >
                    <p className="text-3xl font-bold text-white">{item.value}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                className="pointer-events-none absolute inset-x-6 bottom-[-7vh] z-20"
                style={{ y: handoffY, opacity: handoffOpacity }}
              >
                <div className="landing-panel mx-auto max-w-5xl rounded-[30px] border border-white/[0.12] px-6 py-5 backdrop-blur-2xl">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-sky-100">
                        <Waves className="h-3.5 w-3.5" />
                        Del scroll al demo real
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        Bajá y probá cómo Vibook transforma la inspiración en operación.
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Consulta inicial</div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Cotización asistida</div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Seguimiento comercial</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
