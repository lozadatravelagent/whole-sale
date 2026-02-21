import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Menu, X, ChevronRight } from "lucide-react"

const desktopItems = [
  { label: "Quiénes somos", id: "about" },
  { label: "Funcionalidades", id: "features" },
  { label: "Precios", id: "pricing" },
]

const mobileItems = [
  { label: "Quiénes somos", id: "about" },
  { label: "Integraciones", id: "integrations" },
  { label: "Funcionalidades", id: "features" },
  { label: "Módulos", id: "modules" },
  { label: "Precios", id: "pricing" },
]

export function Navigation() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setMobileOpen(false)
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0a0a0f]/80 backdrop-blur-2xl border-b border-white/[0.08]"
          : "bg-[#0a0a0f]/55 backdrop-blur-xl border-b border-white/[0.05]"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20 md:h-24 gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center group lg:flex-1">
            <img
              src="/vibook-white.png"
              alt="Vibook"
              className="h-10 md:h-11 w-auto"
            />
          </a>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center justify-center gap-1 flex-1">
            {desktopItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="relative px-3 py-2.5 text-sm text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden lg:flex items-center justify-end gap-3 flex-1">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="group flex items-center gap-2 bg-white text-gray-900 px-5 py-2.5 text-base rounded-lg font-medium hover:bg-gray-100 transition-all"
            >
              Probar Emilia
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden pb-6 pt-2"
          >
            <div className="flex flex-col gap-1">
              {mobileItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-left px-4 py-3 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-white/10">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 text-center text-gray-300 hover:text-white rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors"
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => { setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full py-3 text-center bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Probar Emilia
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}
