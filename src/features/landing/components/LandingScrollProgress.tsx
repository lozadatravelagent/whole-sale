import { motion, useScroll, useSpring } from "framer-motion"

export function LandingScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.28,
  })

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-px bg-white/10">
      <motion.div
        className="h-full origin-left bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-200 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
        style={{ scaleX }}
      />
    </div>
  )
}
