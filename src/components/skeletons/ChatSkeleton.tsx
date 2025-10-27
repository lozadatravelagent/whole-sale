import MainLayout from '@/components/layout/MainLayout';

export function ChatSkeleton() {
  return (
    <MainLayout>
      <div className="flex h-full" aria-busy="true" aria-label="Cargando conversaciones">
        {/* Sidebar skeleton - matches ConversationList dimensions */}
        <div className="w-80 border-r p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted/50 animate-pulse rounded" />
          ))}
        </div>

        {/* Message area skeleton - matches ChatMessages layout */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`h-20 bg-muted/50 animate-pulse rounded-lg ${
                  i % 2 === 0 ? 'ml-auto w-3/4' : 'w-3/4'
                }`}
              />
            ))}
          </div>

          {/* Input skeleton - matches MessageInput height */}
          <div className="h-20 border-t p-4">
            <div className="h-12 bg-muted/50 animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
