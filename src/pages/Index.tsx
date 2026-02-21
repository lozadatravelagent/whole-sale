import { Navigation } from '@/features/landing/components/Navigation';
import { PublicChat } from '@/features/public-chat/PublicChat';
import { AboutUs } from '@/features/landing/components/AboutUs';
import { Features } from '@/features/landing/components/Features';
import { Showcase } from '@/features/landing/components/Showcase';
import { Testimonial } from '@/features/landing/components/Testimonial';
import { Pricing } from '@/features/landing/components/Pricing';
import { Footer } from '@/features/landing/components/Footer';
import { CursorGlow } from '@/features/landing/components/CursorGlow';

const Index = () => (
  <main className="landing-shell min-h-screen bg-[#0a0a0f] relative">
    {/* Travel background image */}
    <div
      className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80')" }}
    />
    {/* Dark overlay for readability */}
    <div className="fixed inset-0 z-0 pointer-events-none bg-[#0a0a0f]/60" />

    {/* Page content */}
    <div className="relative z-10">
      <CursorGlow />
      <Navigation />
      <PublicChat />

      {/* Destination highlights */}
      <section className="relative py-16 md:py-20">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-blue-400 font-semibold tracking-wider uppercase mb-3">Destinos populares</p>
          <h2 className="text-center text-3xl md:text-4xl font-bold text-white mb-10">Buscá tu próximo viaje</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { city: "Cancún", country: "México", img: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=640&q=80" },
              { city: "Punta Cana", country: "República Dominicana", img: "https://images.unsplash.com/photo-1580237072617-771c3ecc4a24?w=640&q=80" },
              { city: "Bariloche", country: "Argentina", img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640&q=80" },
            ].map((d) => (
              <div key={d.city} className="group relative h-64 rounded-2xl overflow-hidden border border-white/10">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                     style={{ backgroundImage: `url('${d.img}')` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <h3 className="text-xl font-bold text-white">{d.city}</h3>
                  <p className="text-sm text-gray-300">{d.country}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AboutUs />
      <Features />
      <Showcase />
      <Testimonial />
      <Pricing />
      <Footer />
    </div>
  </main>
);

export default Index;
