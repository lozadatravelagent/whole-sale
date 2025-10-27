import MainLayout from '@/components/layout/MainLayout';

export function CRMSkeleton() {
  return (
    <MainLayout>
      <div className="h-full bg-background" aria-busy="true" aria-label="Cargando CRM">
        {/* Header skeleton - matches CRM.tsx header (lines 341-419) */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="h-8 w-48 bg-muted/50 animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-muted/50 animate-pulse rounded" />
            <div className="h-9 w-32 bg-muted/50 animate-pulse rounded" />
          </div>
        </div>

        {/* Kanban columns skeleton - matches TrelloColumn dimensions (w-72 md:w-80) */}
        <div className="p-4 flex gap-3 overflow-x-auto h-[calc(100vh-80px)]">
          {[1, 2, 3, 4].map(col => (
            <div key={col} className="w-72 md:w-80 flex-shrink-0 space-y-3">
              {/* Column header */}
              <div className="h-10 bg-muted/50 animate-pulse rounded" />

              {/* Cards - matches TrelloCard typical height */}
              {[1, 2, 3].map(card => (
                <div key={card} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
