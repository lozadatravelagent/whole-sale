function PulseBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/60 ${className}`.trim()} />;
}

export default function TripPlannerWorkspaceSkeleton() {
  return (
    <div className="trip-planner-surface @container flex flex-col gap-4 overflow-y-auto p-4 lg:p-6" aria-busy="true" aria-label="Cargando planificador">
      <div className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm">
        <div className="space-y-6 p-4 md:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <PulseBlock className="h-7 w-28 rounded-full" />
              <PulseBlock className="h-7 w-20 rounded-full" />
              <PulseBlock className="h-7 w-40 rounded-full" />
            </div>
            <div className="space-y-2">
              <PulseBlock className="h-10 w-72 max-w-full" />
              <PulseBlock className="h-4 w-full max-w-3xl" />
              <PulseBlock className="h-4 w-5/6 max-w-2xl" />
            </div>
          </div>

          <div className="w-full">
            <div className="h-[320px] rounded-[28px] border border-primary/15 bg-slate-100 p-4 sm:h-[380px]">
              <PulseBlock className="h-full w-full rounded-[24px] bg-[linear-gradient(180deg,rgba(148,163,184,0.18),rgba(148,163,184,0.08))]" />
            </div>
          </div>

          <div className="rounded-3xl border bg-muted/20 p-4 md:p-5">
            <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <PulseBlock className="h-3 w-24" />
                  <PulseBlock className="h-6 w-12 rounded-full" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/85 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <PulseBlock className="h-4 w-4 rounded-md" />
                        <PulseBlock className="h-7 w-7 rounded-full" />
                        <PulseBlock className="h-4 w-24" />
                      </div>
                      <PulseBlock className="h-4 w-4 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                  <PulseBlock className="h-3 w-16" />
                  <PulseBlock className="h-4 w-28" />
                </div>
                <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                  <PulseBlock className="h-3 w-12" />
                  <PulseBlock className="h-4 w-10" />
                </div>
                <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                  <PulseBlock className="h-3 w-20" />
                  <PulseBlock className="h-4 w-16" />
                </div>
                <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                  <PulseBlock className="h-3 w-12" />
                  <PulseBlock className="h-4 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {[1, 2].map((segment) => (
          <div key={segment} className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted/30 p-4">
              <div className="flex flex-col gap-3 @xl:flex-row @xl:items-start @xl:justify-between">
                <div className="space-y-2">
                  <PulseBlock className="h-6 w-52" />
                  <PulseBlock className="h-4 w-72 max-w-full" />
                </div>
                <PulseBlock className="h-9 w-36" />
              </div>
            </div>

            <div className="grid gap-4 p-4 @4xl:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4">
                {[1, 2].map((day) => (
                  <div key={day} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <PulseBlock className="h-5 w-48" />
                        <PulseBlock className="h-4 w-28" />
                      </div>
                      <div className="flex gap-2">
                        <PulseBlock className="h-8 w-28" />
                        <PulseBlock className="h-8 w-8" />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 @xl:grid-cols-3">
                      {[1, 2, 3].map((block) => (
                        <div key={block} className="space-y-2">
                          <PulseBlock className="h-3 w-16" />
                          <PulseBlock className="h-24 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {[1, 2].map((card) => (
                  <div key={card} className="rounded-xl border p-4">
                    <div className="space-y-3">
                      <PulseBlock className="h-5 w-40" />
                      <PulseBlock className="h-4 w-full" />
                      <PulseBlock className="h-4 w-5/6" />
                      <PulseBlock className="h-24 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
