import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Building2, ExternalLink, Hotel, Loader2, MapPin, Phone, ShieldCheck } from 'lucide-react';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { PlannerSegment } from '../types';
import {
  formatDateRange,
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatPlannerTravelerSummary,
  formatRelativeValidationTime,
  getPlannerHotelDisplayId,
  getPriceConfidenceBadgeClass,
  getPriceConfidenceLabel,
  getPriceConfidenceLevel,
} from '../utils';

interface PlannerHotelInventoryDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotel: LocalHotelData | null;
  segment: PlannerSegment;
  hasExactDates: boolean;
  disabled?: boolean;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
}

function HotelImagePlaceholder({
  hotel,
  category,
}: {
  hotel: LocalHotelData;
  category?: string;
}) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center rounded-3xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--muted)),hsl(var(--background)))] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Hotel className="h-7 w-7" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{hotel.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hotel.city}</p>
      {category && (
        <Badge variant="secondary" className="mt-4 rounded-full px-3 py-1">
          {category}
        </Badge>
      )}
    </div>
  );
}

function HotelDetailBody({
  hotel,
  segment,
  hasExactDates,
  disabled = false,
  onSelectHotel,
  onRefreshQuotedHotel,
}: Omit<PlannerHotelInventoryDetailPanelProps, 'open' | 'onOpenChange'>) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const hotelId = getPlannerHotelDisplayId(hotel);
  const category = formatPlannerHotelCategory(hotel.category);
  const travelerSummary = formatPlannerTravelerSummary(hotel);
  const roomLabel = formatPlannerRoomLabel(hotel);
  const isSelected = segment.hotelPlan.selectedHotelId === hotelId;
  const isQuoted = isSelected && (segment.hotelPlan.matchStatus === 'quoted' || segment.hotelPlan.matchStatus === 'matched');
  const isRefreshing = isSelected && segment.hotelPlan.matchStatus === 'quoting';
  const selectedPriceFreshness = isSelected && segment.hotelPlan.quoteLastValidatedAt
    ? formatRelativeValidationTime(segment.hotelPlan.quoteLastValidatedAt)
    : undefined;
  const confidenceLevel = isSelected && segment.hotelPlan.quoteLastValidatedAt
    ? getPriceConfidenceLevel(segment.hotelPlan.quoteLastValidatedAt)
    : undefined;
  const confidenceLabel = confidenceLevel ? getPriceConfidenceLabel(confidenceLevel) : undefined;
  const confidenceBadgeClass = confidenceLevel ? getPriceConfidenceBadgeClass(confidenceLevel) : undefined;
  const images = Array.isArray(hotel.images) ? hotel.images.filter(Boolean) : [];
  const heroImage = images[activeImageIndex] || images[0];
  const roomCount = hotel.rooms?.length || 0;

  useEffect(() => {
    setActiveImageIndex(0);
  }, [hotelId]);

  const topMeta = useMemo(
    () => [
      formatDateRange(hotel.check_in, hotel.check_out),
      `${hotel.nights} noche${hotel.nights === 1 ? '' : 's'}`,
      travelerSummary,
    ].filter(Boolean),
    [hotel.check_in, hotel.check_out, hotel.nights, travelerSummary]
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="overflow-y-auto px-4 pb-32 pt-4 sm:px-6">
        <div className="space-y-5">
          <div className="space-y-3">
            {heroImage ? (
              <div className="space-y-3">
                <img
                  src={heroImage}
                  alt={hotel.name}
                  className="h-64 w-full rounded-3xl border border-border/70 object-cover"
                />
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.slice(0, 6).map((image, index) => (
                      <button
                        key={`${hotelId}-image-${index}`}
                        type="button"
                        className={`shrink-0 overflow-hidden rounded-2xl border transition ${index === activeImageIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border/70'}`}
                        onClick={() => setActiveImageIndex(index)}
                      >
                        <img src={image} alt="" className="h-16 w-20 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <HotelImagePlaceholder hotel={hotel} category={category} />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                EUROVIPS
              </Badge>
              {category && (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {category}
                </Badge>
              )}
              {isSelected && (
                <Badge className="rounded-full px-3 py-1">
                  {isQuoted ? 'Precio real activo' : 'Hotel seleccionado'}
                </Badge>
              )}
            </div>

            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{hotel.name}</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{hotel.address || hotel.city}</span>
                </span>
                {hotel.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    <span>{hotel.phone}</span>
                  </span>
                )}
                {hotel.website && (
                  <a
                    href={hotel.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary transition hover:underline"
                  >
                    Sitio web
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {topMeta.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {topMeta.map((item) => (
                  <span key={item} className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {(hotel.description || roomLabel) && (
            <section className="rounded-3xl border border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Resumen
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {hotel.description || roomLabel}
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-border/70 bg-card/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Habitaciones
              </p>
              <span className="text-xs text-muted-foreground">
                {roomCount} opcion{roomCount === 1 ? '' : 'es'}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {hotel.rooms.length > 0 ? (
                hotel.rooms.map((room, index) => {
                  const totalPrice = formatPlannerPrice(room.total_price, room.currency);
                  const nightlyPrice = formatPlannerPrice(room.price_per_night, room.currency);
                  return (
                    <div key={`${hotelId}-room-${index}`} className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {room.type || `Habitacion ${index + 1}`}
                          </p>
                          {room.description && room.description !== room.type && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {room.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{totalPrice || 'Consultar'}</p>
                          {nightlyPrice && (
                            <p className="text-[11px] text-muted-foreground">{nightlyPrice} por noche</p>
                          )}
                        </div>
                      </div>
                      {typeof room.availability === 'number' && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Disponibilidad: {room.availability}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No llegaron habitaciones detalladas para este hotel.
                </p>
              )}
            </div>
          </section>

          {(hotel.policy_cancellation || hotel.policy_lodging) && (
            <section className="rounded-3xl border border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Politicas
              </p>
              <div className="mt-4 space-y-3">
                {hotel.policy_cancellation && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Cancelacion</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                      {hotel.policy_cancellation}
                    </p>
                  </div>
                )}
                {hotel.policy_lodging && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Alojamiento</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                      {hotel.policy_lodging}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="space-y-3">
          {isSelected && selectedPriceFreshness && confidenceLabel && confidenceBadgeClass && (
            <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${confidenceBadgeClass}`}>
              {confidenceLabel} ({selectedPriceFreshness})
            </div>
          )}
          {isSelected && selectedPriceFreshness && !confidenceLabel && (
            <div className="text-[11px] text-muted-foreground">
              Ultima validacion: {selectedPriceFreshness}
            </div>
          )}
          {!hasExactDates && (
            <p className="text-[11px] text-muted-foreground">
              Defini fechas exactas para validar disponibilidad y precio real.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              disabled={disabled || isSelected}
              onClick={() => void onSelectHotel(segment.id, hotelId)}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {isSelected ? 'Hotel seleccionado' : 'Usar este hotel'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={disabled || !hasExactDates || !isSelected || isRefreshing}
              onClick={() => void onRefreshQuotedHotel(segment.id)}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              Actualizar precio real
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlannerHotelInventoryDetailPanel(props: PlannerHotelInventoryDetailPanelProps) {
  const { open, onOpenChange, hotel, segment } = props;
  const isMobile = useIsMobile();

  if (!hotel) {
    return null;
  }

  const title = hotel.name;
  const description = `${segment.city} · ${formatDateRange(hotel.check_in, hotel.check_out)}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="px-4 pt-4">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <HotelDetailBody {...props} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl lg:max-w-2xl">
        <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <HotelDetailBody {...props} />
      </SheetContent>
    </Sheet>
  );
}
