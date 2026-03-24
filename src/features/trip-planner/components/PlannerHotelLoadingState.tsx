/**
 * Skeleton loading state for hotel search results.
 * Matches the layout of PlannerHotelInventorySection hotel cards.
 */
export default function PlannerHotelLoadingState() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-full animate-pulse rounded-2xl border border-border/70 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-3/5 rounded bg-muted" />
                <div className="h-4 w-12 rounded-full bg-muted" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-muted" />
                <div className="h-3 w-2/5 rounded bg-muted" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            </div>
            <div className="shrink-0 space-y-2 text-right">
              <div className="ml-auto h-4 w-16 rounded bg-muted" />
              <div className="ml-auto h-3 w-20 rounded bg-muted" />
              <div className="ml-auto h-3 w-14 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
