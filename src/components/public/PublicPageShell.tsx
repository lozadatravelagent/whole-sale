import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PublicPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  updatedAt?: string;
}

export function PublicPageShell({ title, subtitle, children, updatedAt }: PublicPageShellProps) {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/vibook-white.png" alt="Vibook" className="h-8 w-auto" />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 py-14 md:py-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{title}</h1>
          <p className="text-gray-300 text-lg md:text-xl leading-relaxed">{subtitle}</p>
          {updatedAt && <p className="text-sm text-gray-500 mt-4">Actualizado: {updatedAt}</p>}
        </div>

        <div className="mt-12 max-w-4xl">{children}</div>
      </section>
    </main>
  );
}
