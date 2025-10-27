import MainLayout from '@/components/layout/MainLayout';

export function DashboardSkeleton() {
  return (
    <MainLayout>
      <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8" aria-busy="true" aria-label="Cargando dashboard">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 md:h-9 w-64 bg-muted/50 animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted/50 animate-pulse rounded" />
          </div>
          <div className="h-6 w-32 bg-muted/50 animate-pulse rounded" />
        </div>

        {/* Objectives card skeleton */}
        <div className="bg-card rounded-lg border shadow-sm p-4 md:p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted/50 animate-pulse rounded" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-muted/50 animate-pulse rounded" />
                <div className="h-6 w-24 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="h-2 w-full bg-muted/50 animate-pulse rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-muted/50 animate-pulse rounded" />
                <div className="h-6 w-16 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="h-2 w-full bg-muted/50 animate-pulse rounded" />
            </div>
          </div>
        </div>

        {/* Metric cards grid skeleton */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-lg border shadow-sm p-4 md:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-muted/50 animate-pulse rounded" />
                <div className="h-8 w-8 bg-muted/50 animate-pulse rounded-full" />
              </div>
              <div className="h-8 w-20 bg-muted/50 animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Activities/Performance section skeleton */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Left card */}
          <div className="bg-card rounded-lg border shadow-sm p-4 md:p-6 space-y-4">
            <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 bg-muted/50 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted/50 animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted/50 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right card */}
          <div className="bg-card rounded-lg border shadow-sm p-4 md:p-6 space-y-4">
            <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 bg-muted/50 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted/50 animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted/50 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
