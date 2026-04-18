import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, MapPin, Plane } from 'lucide-react';
import UnifiedLayout from '@/components/layouts/UnifiedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { signOutConsumer } from '@/features/companion/services/consumerAuthService';

interface ConsumerTripCardData {
  id: string;
  conversation_id: string | null;
  title: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  destination_cities: string[] | null;
  updated_at: string;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Fechas por definir';
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  try {
    if (start && end) {
      return `${new Date(start).toLocaleDateString('es-AR', opts)} - ${new Date(end).toLocaleDateString('es-AR', opts)}`;
    }
    if (start) return `Desde ${new Date(start).toLocaleDateString('es-AR', opts)}`;
    if (end) return `Hasta ${new Date(end).toLocaleDateString('es-AR', opts)}`;
  } catch {
    /* noop */
  }
  return 'Fechas por definir';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'exploring':
      return 'Explorando';
    case 'ready':
      return 'Listo';
    case 'quoted':
      return 'Cotizado';
    case 'confirmed':
      return 'Confirmado';
    case 'shared':
      return 'Compartido';
    case 'draft':
      return 'Borrador';
    default:
      return status;
  }
}

export default function ConsumerProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<ConsumerTripCardData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id) return;
      setIsLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('trips')
        .select('id, conversation_id, title, status, start_date, end_date, destination_cities, updated_at')
        .eq('owner_user_id', user.id)
        .eq('account_type', 'consumer')
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });

      if (cancelled) return;
      if (queryError) {
        setError('No se pudieron cargar tus viajes.');
        setTrips([]);
      } else {
        setTrips((data ?? []) as ConsumerTripCardData[]);
      }
      setIsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await signOutConsumer();
    navigate('/emilia', { replace: true });
  };

  return (
    <UnifiedLayout>
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tu perfil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Email</span>
              <span className="text-sm">{user?.email ?? '—'}</span>
            </div>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="self-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plane className="h-5 w-5" />
              Mis viajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !trips || trips.length === 0 ? (
              <div className="flex flex-col items-start gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Todavía no arrancaste ningún viaje.
                </p>
                <Button asChild size="sm">
                  <Link to="/emilia/chat">Empezar ahora</Link>
                </Button>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {trips.map((trip) => {
                  const destinations = (trip.destination_cities ?? []).filter(Boolean);
                  const href = trip.conversation_id
                    ? `/emilia/chat/${trip.conversation_id}`
                    : '/emilia/chat';
                  return (
                    <li key={trip.id}>
                      <Link
                        to={href}
                        className="block rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground line-clamp-1">
                              {trip.title || destinations[0] || 'Viaje sin título'}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {statusLabel(trip.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {destinations.length > 0 ? destinations.join(', ') : 'Destino por definir'}
                            </span>
                            <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}
