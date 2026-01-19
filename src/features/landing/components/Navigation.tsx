import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Menu, X, ChevronRight } from "lucide-react"

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
      element.scrollIntoView({ behavior: "smooth" })
    }
    setMobileOpen(false)
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0a0a0f]/80 backdrop-blur-2xl border-b border-white/[0.08]"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-18 md:h-24">
          {/* Logo */}
          <a href="/" className="flex items-center group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <span className="text-2xl font-bold text-white">Vibook</span>
            </div>
          </a>

          {/* Desktop nav - Centered */}
          <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {[
              { label: "Funcionalidades", id: "features" },
              { label: "Modulos", id: "modules" },
              { label: "Emilia IA", id: "emilia" },
              { label: "Precios", id: "pricing" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="relative px-5 py-2.5 text-base text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
            >
              Iniciar sesion
            </button>
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center gap-2 bg-white text-gray-900 px-5 py-2.5 text-base rounded-lg font-medium hover:bg-gray-100 transition-all"
            >
              Comenzar gratis
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
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
            className="md:hidden pb-6 pt-2"
          >
            <div className="flex flex-col gap-1">
              {[
                { label: "Funcionalidades", id: "features" },
                { label: "Modulos", id: "modules" },
                { label: "Emilia IA", id: "emilia" },
                { label: "Precios", id: "pricing" },
              ].map((item) => (
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
                  Iniciar sesion
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 text-center bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Comenzar gratis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}
