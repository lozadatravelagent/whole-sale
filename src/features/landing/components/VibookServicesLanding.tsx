import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  Database,
  Eye,
  Globe2,
  KanbanSquare,
  Layers3,
  Percent,
  PlayCircle,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  chips: string[];
};

type RoleCard = {
  name: string;
  description: string;
  icon: LucideIcon;
  access: string[];
};

const navItems = [
  { label: "Producto", href: "#producto" },
  { label: "Modulos", href: "#modulos" },
  { label: "Roles", href: "#roles" },
  { label: "Precios", href: "#precios" },
];

const heroSignals = [
  { value: "5 roles", label: "Permisos por puesto" },
  { value: "ARS + USD", label: "Caja multidivisa" },
  { value: "AFIP", label: "Facturacion integrada" },
  { value: "IA", label: "Consultas en lenguaje natural" },
];

const overviewCards = [
  {
    title: "CRM y pipeline comercial",
    description: "Lead entrante, seguimiento, tareas y sync con Trello en una sola vista.",
    rows: ["Lead nuevo / WhatsApp", "Cotizacion enviada / Pendiente", "Cierre / Pago inicial"],
  },
  {
    title: "Operaciones con contexto real",
    description: "Cotizacion, reserva, documentacion, pagos y operador dentro del mismo viaje.",
    rows: ["Reserva confirmada", "DNI pendiente", "Pago final en revision"],
  },
  {
    title: "Caja, contabilidad y margen",
    description: "Caja ARS/USD, FX automatico y libro mayor sin volver a Excel.",
    rows: ["ARS 9,8M", "USD 14,3K", "FX detectado"],
  },
  {
    title: "IA operativa y OCR",
    description: "Preguntas de negocio, OCR de documentos y alertas accionables desde el copiloto.",
    rows: ["?Cuanto vendi este mes?", "7 pagos vencidos", "3 clientes creados por OCR"],
  },
];

const features: Feature[] = [
  {
    title: "CRM & Pipeline de ventas",
    description: "Kanban interactivo con captura automatica de leads y sync bidireccional con Trello.",
    icon: KanbanSquare,
    accent: "bg-[#0071E3]/10 text-[#0071E3]",
    chips: ["Kanban", "Sync Trello"],
  },
  {
    title: "Gestion de operaciones",
    description: "Cotizacion, reserva, confirmacion y cierre en un flujo continuo por viaje.",
    icon: Workflow,
    accent: "bg-[#5AC8FA]/15 text-[#0B84D8]",
    chips: ["Operador", "Pasajeros"],
  },
  {
    title: "Contabilidad de partida doble",
    description: "Cada cobro genera debitos y creditos automaticamente sin carga manual.",
    icon: Calculator,
    accent: "bg-[#30D158]/12 text-[#129A3C]",
    chips: ["Libro mayor", "Asientos automaticos"],
  },
  {
    title: "Caja y pagos multidivisa",
    description: "Control de caja en ARS y USD con diferencias de cambio detectadas en tiempo real.",
    icon: Wallet,
    accent: "bg-[#0071E3]/10 text-[#0071E3]",
    chips: ["ARS/USD", "FX"],
  },
  {
    title: "Cerebro IA",
    description: "Consultas de negocio en lenguaje natural para ventas, vencimientos y caja.",
    icon: Bot,
    accent: "bg-[#5AC8FA]/15 text-[#0B84D8]",
    chips: ["GPT-4o", "Copiloto"],
  },
  {
    title: "OCR de documentos",
    description: "Escanea pasaportes y DNI con la camara para crear clientes al instante.",
    icon: ScanLine,
    accent: "bg-[#30D158]/12 text-[#129A3C]",
    chips: ["Pasaporte", "DNI"],
  },
  {
    title: "Facturacion AFIP",
    description: "Facturas A, B, C y E con CAE integrado y PDF listo para enviar.",
    icon: ReceiptText,
    accent: "bg-[#0071E3]/10 text-[#0071E3]",
    chips: ["CAE", "PDF"],
  },
  {
    title: "Alertas automaticas",
    description: "Pagos vencidos, viajes proximos, documentacion faltante y saldo critico.",
    icon: BellRing,
    accent: "bg-[#5AC8FA]/15 text-[#0B84D8]",
    chips: ["Vencimientos", "Seguimiento"],
  },
  {
    title: "Comisiones automaticas",
    description: "Calculo por margen con split entre vendedor principal y secundario.",
    icon: Percent,
    accent: "bg-[#30D158]/12 text-[#129A3C]",
    chips: ["Split", "Margen"],
  },
  {
    title: "Reportes y dashboard",
    description: "KPIs, ranking, destinos top y rentabilidad desde una sola capa de lectura.",
    icon: BarChart3,
    accent: "bg-[#0071E3]/10 text-[#0071E3]",
    chips: ["KPIs", "Rentabilidad"],
  },
];

const roles: RoleCard[] = [
  {
    name: "Super Admin",
    description: "Supervisa multiples agencias, branding y configuracion global.",
    icon: ShieldCheck,
    access: ["Tenant y sucursales", "Integraciones", "Vision global"],
  },
  {
    name: "Admin",
    description: "Opera la agencia y sigue el rendimiento comercial del equipo.",
    icon: Building2,
    access: ["CRM", "Operaciones", "Dashboard"],
  },
  {
    name: "Contable",
    description: "Controla caja, facturacion, comisiones y asientos contables.",
    icon: Calculator,
    access: ["Caja", "AFIP", "Partida doble"],
  },
  {
    name: "Vendedor",
    description: "Ve solo sus leads, viajes y alertas asignadas.",
    icon: Sparkles,
    access: ["Pipeline personal", "Seguimiento", "Comisiones"],
  },
  {
    name: "Observador",
    description: "Consulta informacion clave sin tocar operaciones sensibles.",
    icon: Eye,
    access: ["Lectura", "Paneles", "Auditoria visual"],
  },
];

const integrations = [
  { title: "Trello", description: "Sync bidireccional del pipeline.", icon: Layers3 },
  { title: "AFIP", description: "Facturacion electronica y CAE.", icon: ReceiptText },
  { title: "OpenAI GPT-4o", description: "IA operativa y OCR.", icon: Bot },
  { title: "Supabase", description: "Datos multi-tenant en tiempo real.", icon: Database },
];

const proofCards = [
  {
    title: "Multi-agencia nativo",
    description: "Sucursales, usuarios y datos separados sin mezclar operaciones.",
  },
  {
    title: "Branding por agencia",
    description: "Cada unidad puede tener identidad visual y documentos propios.",
  },
  {
    title: "Datos en tiempo real",
    description: "Ventas, caja, alertas y reportes actualizados sobre el flujo real.",
  },
];

const appLoginUrl = "https://app.vibook.ai/login";

const pricingCards = [
  {
    name: "Starter",
    subtitle: "Para agencias que quieren ordenar leads y seguimiento.",
    badge: "Plan base",
    price: "79.900",
    note: "Probalo 14 dias gratis",
    ctaLabel: "Probalo 14 dias gratis",
    ctaType: "login",
    items: ["CRM y pipeline", "Operaciones basicas", "1 marca"],
    highlighted: false,
  },
  {
    name: "Pro",
    subtitle: "Para agencias que quieren operar, cobrar y facturar desde un solo sistema.",
    badge: "Mas elegido",
    price: "99.900",
    note: "Probalo 14 dias gratis",
    ctaLabel: "Probalo 14 dias gratis",
    ctaType: "login",
    items: ["CRM + operaciones", "Caja y contabilidad", "AFIP + IA"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    subtitle: "Para grupos con varias sucursales y permisos finos.",
    badge: "A medida",
    price: "Consultar",
    note: "Precio y onboarding a medida",
    ctaLabel: "Hablar con ventas",
    ctaType: "contact",
    items: ["Multi-agencia", "Permisos avanzados", "Onboarding dedicado"],
    highlighted: false,
  },
];

const revealEase = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: revealEase }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <div className="mb-4 inline-flex rounded-full border border-[#0071E3]/15 bg-[#0071E3]/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#0071E3]">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#1D1D1F] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#5F6065] sm:text-lg">{description}</p>
    </div>
  );
}

function BrowserFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#D9D9DE] bg-white shadow-[0_40px_120px_-48px_rgba(0,113,227,0.42)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E5EA] bg-[#F7F7F8] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="rounded-full border border-[#E1E1E6] bg-white px-3 py-1 text-[11px] font-medium text-[#6E6E73]">
          {title}
        </div>
        <div className="hidden h-2 w-16 rounded-full bg-black/6 sm:block" />
      </div>
      {children}
    </div>
  );
}

export function VibookServicesLanding() {
  return (
    <main
      className="min-h-screen bg-[#FFFFFF] text-[#1D1D1F]"
      style={{ fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}
    >
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#ECECEE] bg-[rgba(255,255,255,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <a href="#top" className="flex items-center gap-3">
            <img src="/vibook-black.png" alt="Vibook Services" className="h-8 w-auto" />
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="text-sm font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" className="hidden rounded-full px-4 text-[#1D1D1F] hover:bg-black/5 sm:inline-flex">
              <Link to="/documentacion">Documentacion</Link>
            </Button>
            <Button asChild className="rounded-full bg-[#0071E3] px-5 text-white hover:bg-[#0060C2]">
              <a href={appLoginUrl}>Comenzar gratis</a>
            </Button>
          </div>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden border-b border-[#ECECEE] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFAFA_72%,#FFFFFF_100%)] pt-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-8 h-72 w-72 rounded-full bg-[#0071E3]/10 blur-3xl" />
          <div className="absolute right-[-6%] top-10 h-80 w-80 rounded-full bg-[#5AC8FA]/16 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(0,113,227,0.06)_0%,rgba(255,255,255,0)_100%)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-20 lg:pb-24">
          <Reveal className="mx-auto max-w-4xl text-center">
            <div>
              <div className="inline-flex rounded-full border border-[#0071E3]/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#0071E3] shadow-[0_16px_50px_-35px_rgba(0,113,227,0.45)]">
                ERP/CRM todo-en-uno para agencias de viaje
              </div>
              <h1 className="mt-6 text-5xl font-semibold tracking-[-0.07em] text-[#1D1D1F] sm:text-6xl lg:text-7xl">
                Gestion inteligente para agencias de viaje
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[#5F6065] sm:text-xl">
                CRM, operaciones, contabilidad y facturacion electronica en un solo lugar. Potenciado por IA.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="h-12 rounded-full bg-[#0071E3] px-6 text-base text-white hover:bg-[#0060C2]">
                  <a href={appLoginUrl}>
                    Comenzar gratis
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-[#D9D9DE] bg-white px-6 text-base text-[#1D1D1F] hover:bg-black/5">
                  <a href="#demo">
                    Ver demo
                    <PlayCircle className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {heroSignals.map((signal, index) => (
                  <motion.div
                    key={signal.value}
                    className="rounded-[24px] border border-[#D7D7DC] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.12)]"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.55, delay: index * 0.08, ease: revealEase }}
                  >
                    <div className="text-lg font-semibold tracking-[-0.04em] text-[#1D1D1F]">{signal.value}</div>
                    <div className="mt-1 text-sm text-[#6E6E73]">{signal.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="demo" className="border-b border-[#ECECEE] bg-[#FFFFFF] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <BrowserFrame title="Vibook Services · Demo del dashboard">
              <div className="relative bg-[#0D1117]">
                <video src="/promo.mp4" autoPlay muted loop playsInline className="aspect-[16/10] w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,15,18,0)_0%,rgba(15,15,18,0.1)_48%,rgba(15,15,18,0.35)_100%)]" />
              </div>
            </BrowserFrame>
          </Reveal>
        </div>
      </section>

      <section id="producto" className="border-b border-[#ECECEE] bg-[#FFFFFF] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionTitle
              eyebrow="Problema / Solucion"
              title="Dejar de pegar piezas sueltas tambien es crecimiento"
              description="Vibook Services esta pensado para agencias argentinas y latinas que venden, operan, cobran y facturan todos los dias. No para equipos que quieren administrar cinco sistemas al mismo tiempo."
            />
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Reveal>
              <div className="rounded-[32px] border border-[#DEDEE3] bg-[#FAFAFA] p-6 shadow-[0_20px_70px_-48px_rgba(0,0,0,0.3)] sm:p-8">
                <div className="inline-flex rounded-full bg-[#1D1D1F] px-3 py-1 text-xs font-medium text-white">El problema</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#1D1D1F]">
                  Tu agencia usa 5 herramientas distintas que no se hablan entre si
                </h3>
                <p className="mt-4 text-base leading-7 text-[#6E6E73]">
                  Excel para cuentas, Trello para leads, WhatsApp para seguimiento, un sistema aparte para facturar y hojas paralelas para comisiones.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    "Datos duplicados y errores de carga",
                    "Cobros, reservas y contabilidad fuera de sincronia",
                    "Seguimiento comercial disperso en distintas herramientas",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-[#1D1D1F]/6" />
                      <div className="text-sm leading-6 text-[#4D4D52]">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="rounded-[32px] border border-[#0071E3]/10 bg-[linear-gradient(180deg,#F7FBFF_0%,#FFFFFF_100%)] p-6 shadow-[0_24px_90px_-52px_rgba(0,113,227,0.35)] sm:p-8">
                <div className="inline-flex rounded-full bg-[#0071E3] px-3 py-1 text-xs font-medium text-white">La solucion</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#1D1D1F]">
                  Vibook unifica todo en una sola plataforma disenada para agencias
                </h3>
                <p className="mt-4 text-base leading-7 text-[#5F6065]">
                  Desde el lead inicial hasta el asiento contable y la factura AFIP. Cada area trabaja sobre la misma informacion, con permisos por rol y datos en tiempo real.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "CRM + pipeline comercial",
                    "Operaciones y seguimiento por viaje",
                    "Caja, comisiones y contabilidad",
                    "IA, OCR y facturacion electronica",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-[#0071E3]/10 bg-white px-4 py-4 text-sm font-medium text-[#1D1D1F]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="modulos" className="border-b border-[#ECECEE] bg-[#FAFAFA] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionTitle
              eyebrow="Producto"
              title="Un solo workspace para vender, operar, cobrar y facturar"
              description="La landing muestra el producto como realmente se usa: pipeline, operaciones, caja, IA y reportes integrados en una misma capa de trabajo."
            />
          </Reveal>

          <div className="mt-12 grid gap-6 xl:grid-cols-2">
            {overviewCards.map((card, index) => (
              <Reveal key={card.title} delay={index * 0.04}>
                <div className="rounded-[28px] border border-[#DEDEE3] bg-white p-6 shadow-[0_24px_80px_-44px_rgba(20,20,20,0.35)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#1D1D1F]">{card.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#6E6E73]">{card.description}</p>
                    </div>
                    <div className="hidden rounded-full border border-[#0071E3]/15 bg-[#0071E3]/5 px-3 py-1 text-xs font-medium text-[#0071E3] sm:inline-flex">
                      Vista realista
                    </div>
                  </div>
                  <div className="mt-6 rounded-[24px] bg-[#F7F7F8] p-4">
                    <div className="grid gap-3">
                      {card.rows.map((row) => (
                        <div key={row} className="flex items-center justify-between rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3">
                          <span className="text-sm text-[#1D1D1F]">{row}</span>
                          <span className="rounded-full bg-[#0071E3]/6 px-2.5 py-1 text-xs font-medium text-[#0071E3]">Activo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  className="rounded-[28px] border border-[#DEDEE3] bg-white p-6 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.32)]"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: index * 0.03, ease: revealEase }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={cn("inline-flex rounded-2xl p-3", feature.accent)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#C8C8CC]" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[#1D1D1F]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#6E6E73]">{feature.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {feature.chips.map((chip) => (
                      <span key={chip} className="rounded-full border border-[#E1E1E6] bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#4D4D52]">
                        {chip}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="roles" className="border-b border-[#ECECEE] bg-[#FFFFFF] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionTitle
              eyebrow="Roles y permisos"
              title="Cada persona ve lo que necesita para trabajar"
              description="Vibook soporta 5 roles nativos para separar control, operacion, contabilidad y visibilidad sin duplicar herramientas."
            />
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-5">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <motion.div
                  key={role.name}
                  className="rounded-[28px] border border-[#DEDEE3] bg-[#FAFAFA] p-6"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: index * 0.04, ease: revealEase }}
                >
                  <div className="inline-flex rounded-2xl bg-white p-3 text-[#0071E3] shadow-[0_16px_48px_-32px_rgba(0,113,227,0.35)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#1D1D1F]">{role.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6E6E73]">{role.description}</p>
                  <div className="mt-5 space-y-2">
                    {role.access.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-[#4D4D52]">
                        <Check className="h-4 w-4 text-[#30D158]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#ECECEE] bg-[#FAFAFA] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionTitle
              eyebrow="Integraciones"
              title="Conectado con las piezas que una agencia realmente usa"
              description="Trello, AFIP, OpenAI y Supabase conectan ventas, documentacion, facturacion y datos en la nube."
            />
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {integrations.map((integration, index) => {
              const Icon = integration.icon;
              return (
                <motion.div
                  key={integration.title}
                  className="rounded-[28px] border border-[#DEDEE3] bg-white p-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: index * 0.04, ease: revealEase }}
                >
                  <div className="inline-flex rounded-2xl bg-[#0071E3]/8 p-3 text-[#0071E3]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#1D1D1F]">{integration.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6E6E73]">{integration.description}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-16 grid gap-4 lg:grid-cols-3">
            {proofCards.map((card, index) => (
              <motion.div
                key={card.title}
                className="rounded-[28px] border border-[#DEDEE3] bg-white p-6 shadow-[0_20px_70px_-50px_rgba(0,0,0,0.32)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: 0.06 + index * 0.05, ease: revealEase }}
              >
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0071E3]">Senal del producto</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#1D1D1F]">{card.title}</div>
                <p className="mt-3 text-sm leading-6 text-[#6E6E73]">{card.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="precios" className="border-b border-[#ECECEE] bg-[#FFFFFF] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionTitle
              eyebrow="Pricing"
              title="Planes listos para acompanar el crecimiento de la agencia"
              description="La estructura queda preparada para comunicar un pricing simple. Por ahora se deja como placeholder con foco en la prueba gratis."
            />
          </Reveal>

          <div className="mt-12 grid gap-4 xl:grid-cols-3">
            {pricingCards.map((card, index) => (
              <motion.div
                key={card.name}
                className={cn(
                  "rounded-[32px] border p-7",
                  card.highlighted
                    ? "border-[#0071E3]/15 bg-[linear-gradient(180deg,#F7FBFF_0%,#FFFFFF_100%)] shadow-[0_32px_100px_-56px_rgba(0,113,227,0.4)]"
                    : "border-[#DEDEE3] bg-[#FAFAFA]",
                )}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: revealEase }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#1D1D1F]">{card.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#6E6E73]">{card.subtitle}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", card.highlighted ? "bg-[#0071E3] text-white" : "bg-white text-[#6E6E73]")}>
                    {card.badge}
                  </span>
                </div>
                <div className="mt-8 text-4xl font-semibold tracking-[-0.06em] text-[#1D1D1F]">{card.price}</div>
                <div className="mt-2 text-sm text-[#6E6E73]">{card.note}</div>
                <div className="mt-8 space-y-3">
                  {card.items.map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-[#4D4D52]">
                      <Check className="h-4 w-4 text-[#30D158]" />
                      {item}
                    </div>
                  ))}
                </div>
                <Button
                  asChild
                  size="lg"
                  className={cn("mt-8 h-12 w-full rounded-full", card.highlighted ? "bg-[#0071E3] text-white hover:bg-[#0060C2]" : "bg-[#1D1D1F] text-white hover:bg-black/85")}
                >
                  {card.ctaType === "contact" ? (
                    <Link to="/contacto">{card.ctaLabel}</Link>
                  ) : (
                    <a href={appLoginUrl}>{card.ctaLabel}</a>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#FFFFFF] py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <img src="/vibook-black.png" alt="Vibook Services" className="h-8 w-auto" />
            <p className="mt-4 max-w-md text-sm leading-6 text-[#6E6E73]">
              vibook.ai
              <br />
              ERP/CRM todo-en-uno para agencias de viaje que quieren operar con menos friccion y mas visibilidad.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[#4D4D52] sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <a href="#producto" className="transition-colors hover:text-[#0071E3]">Producto</a>
            <a href="#precios" className="transition-colors hover:text-[#0071E3]">Precios</a>
            <Link to="/documentacion" className="transition-colors hover:text-[#0071E3]">Documentacion</Link>
            <Link to="/contacto" className="transition-colors hover:text-[#0071E3]">Contacto</Link>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-[#E5E5EA] px-6 pt-6 text-sm text-[#86868B] sm:flex-row sm:items-center sm:justify-between">
          <div>Todo el flujo de la agencia, desde el lead hasta la factura.</div>
          <div className="flex items-center gap-5">
            <div className="inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Multi-agencia
            </div>
            <div className="inline-flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              AFIP integrada
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
