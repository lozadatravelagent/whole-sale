import { useNavigate } from "react-router-dom"

export function Footer() {
  const navigate = useNavigate()

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <footer className="py-20 bg-[#050508]/95 border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/vibook-white.png"
                alt="Vibook"
                className="h-12 w-auto"
              />
            </div>
            <p className="text-gray-500 text-base leading-relaxed">
              Plataforma de gestión comercial y operativa para agencias de viajes.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Producto</h4>
            <ul className="space-y-4">
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Quiénes somos
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('integrations')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Integraciones
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Funcionalidades
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('modules')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Módulos
                </button>
              </li>
              <li>
              <button
                onClick={() => scrollToSection('emilia')}
                className="text-gray-500 hover:text-white transition-colors text-base"
              >
                Emilia
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-gray-500 hover:text-white transition-colors text-base"
              >
                Precios
              </button>
            </li>
            <li>
                <button
                  onClick={() => navigate('/login')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Iniciar sesión
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Recursos</h4>
            <ul className="space-y-4">
              <li>
                <button
                  onClick={() => navigate('/documentacion')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Documentación
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/soporte')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Soporte
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('cta')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Contacto
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Legal</h4>
            <ul className="space-y-4">
              <li>
                <button
                  onClick={() => navigate('/terminos')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Términos de servicio
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/privacidad')}
                  className="text-gray-500 hover:text-white transition-colors text-base"
                >
                  Privacidad
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-base">
            © {new Date().getFullYear()} Vibook. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-gray-600 text-base">Hecho en Argentina para la industria del turismo</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
