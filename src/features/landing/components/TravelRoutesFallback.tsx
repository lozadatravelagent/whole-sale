const routes = [
  "M 36 68 Q 34 46 43 33",
  "M 36 68 Q 43 48 54 37",
  "M 36 68 Q 55 42 69 34",
  "M 36 68 Q 42 60 47 78",
]

export function TravelRoutesFallback() {
  return (
    <div className="relative h-full min-h-[340px] overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_22%,rgba(56,189,248,0.28),transparent_34%),radial-gradient(circle_at_74%_28%,rgba(251,191,36,0.14),transparent_26%),linear-gradient(160deg,rgba(2,6,23,0.98),rgba(7,12,28,0.94))]" />
      <div className="absolute inset-4 rounded-[24px] border border-white/10 bg-slate-950/65 backdrop-blur-xl" />
      <div className="absolute inset-4 rounded-[24px] bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.08)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35" />

      <div className="absolute left-6 top-6 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
        Earth view
      </div>

      <div className="absolute inset-x-0 top-[18%] flex justify-center">
        <div className="relative h-[286px] w-[286px]">
          <div className="absolute inset-[-8%] rounded-full border border-sky-300/15 bg-sky-300/5 blur-md" />
          <div className="absolute inset-[-3%] rounded-full bg-sky-300/10 blur-2xl" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_24%,rgba(255,255,255,0.22),transparent_18%),radial-gradient(circle_at_52%_48%,rgba(8,145,178,0.16),transparent_58%),linear-gradient(160deg,#10243e_0%,#081626_64%,#03060d_100%)] shadow-[0_42px_120px_-42px_rgba(56,189,248,0.78)]" />
          <div className="absolute inset-[2%] overflow-hidden rounded-full border border-white/[0.12]">
            <div
              className="absolute inset-0 bg-cover bg-[position:46%_50%]"
              style={{ backgroundImage: "url('/earth/earth-day.jpg')" }}
            />
            <div
              className="absolute inset-0 bg-cover bg-[position:48%_50%] opacity-55 mix-blend-screen"
              style={{ backgroundImage: "url('/earth/earth-night.jpg')" }}
            />
            <div
              className="absolute inset-0 bg-cover bg-[position:50%_50%] opacity-35 mix-blend-screen"
              style={{ backgroundImage: "url('/earth/earth-clouds.png')" }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.34),transparent_18%),linear-gradient(108deg,rgba(255,255,255,0.08)_0%,transparent_36%,transparent_54%,rgba(2,6,23,0.1)_70%,rgba(2,6,23,0.82)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,transparent_40%,rgba(2,6,23,0.22)_70%,rgba(2,6,23,0.64)_100%)]" />

            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="fallbackRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.08" />
                  <stop offset="55%" stopColor="#e0f2fe" stopOpacity="0.84" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.74" />
                </linearGradient>
              </defs>

              {routes.map((route, index) => (
                <path
                  key={route}
                  d={route}
                  fill="none"
                  stroke="url(#fallbackRouteGradient)"
                  strokeWidth={index === 0 ? "1" : "0.8"}
                  strokeLinecap="round"
                  strokeDasharray="2.4 2.8"
                />
              ))}

              <circle cx="36" cy="68" r="2.3" fill="#f8fafc" />
              <circle cx="36" cy="68" r="4.4" fill="#38bdf8" fillOpacity="0.2" />
              <circle cx="43" cy="33" r="1.8" fill="#f8fafc" />
              <circle cx="54" cy="37" r="1.7" fill="#f8fafc" />
              <circle cx="69" cy="34" r="1.6" fill="#f8fafc" />
              <circle cx="47" cy="78" r="1.5" fill="#f8fafc" />
            </svg>
          </div>

          <div className="absolute inset-[-2%] rounded-full border border-sky-300/15" />
          <div className="absolute inset-[-7%] rounded-full border border-sky-300/10" />
        </div>
      </div>

      <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Vuelo</p>
          <p className="mt-1 text-sm font-semibold text-white">Confirmado</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Hotel</p>
          <p className="mt-1 text-sm font-semibold text-white">Cotizado</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">CRM</p>
          <p className="mt-1 text-sm font-semibold text-white">Activo</p>
        </div>
      </div>
    </div>
  )
}
