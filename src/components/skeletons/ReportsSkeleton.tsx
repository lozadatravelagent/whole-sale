import MainLayout from '@/components/layout/MainLayout';

export function ReportsSkeleton() {
  return (
    <MainLayout>
      <div className="p-6 space-y-6" aria-busy="true" aria-label="Cargando reportes">
        {/* Header skeleton */}
        <div className="h-10 w-48 bg-muted/50 animate-pulse rounded" />

        {/* Metric cards skeleton - EXACT dimensions from Dashboard.tsx metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>

        {/* Charts skeleton - EXACT positioning from Reports.tsx grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TrendsChart placeholder */}
          <div className="h-80 bg-muted/50 animate-pulse rounded-lg" />
          {/* Other charts placeholder */}
          <div className="h-80 bg-muted/50 animate-pulse rounded-lg" />
        </div>
      </div>
    </MainLayout>
  );
}
