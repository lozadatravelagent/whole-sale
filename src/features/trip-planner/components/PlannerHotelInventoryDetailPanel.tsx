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
import { Check, ExternalLink, Hotel, Loader2, MapPin, Phone } from 'lucide-react';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { PlannerSegment } from '../types';
import {
  formatDateRange,
  formatHotelDistanceLabel,
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatPlannerTravelerSummary,
  formatRelativeValidationTime,
  getHotelDistanceTag,
  getPlannerHotelDisplayId,
  getPriceConfidenceBadgeClass,
  getPriceConfidenceLabel,
  getPriceConfidenceLevel,
} from '../utils';

const DISTANCE_TAG_CLASSES = {
  centro: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  cercano: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400',
  alejado: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
} as const;

export interface PlannerHotelInventoryDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotel: LocalHotelData | null;
  segment: PlannerSegment;
  hasExactDates: boolean;
  disabled?: boolean;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
  distanceKm?: number;
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

export function PlannerHotelInventoryDetailBody({
  hotel,
  segment,
  hasExactDates,
  disabled = false,
  onSelectHotel,
  distanceKm,
  onConfirmed,
}: Omit<PlannerHotelInventoryDetailPanelProps, 'open' | 'onOpenChange'> & { onConfirmed?: () => void }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const hotelId = getPlannerHotelDisplayId(hotel);
  const category = formatPlannerHotelCategory(hotel.category);
  const distanceTag = distanceKm != null ? getHotelDistanceTag(distanceKm) : undefined;
  const travelerSummary = formatPlannerTravelerSummary(hotel);
  const roomLabel = formatPlannerRoomLabel(hotel);
  const isSelected = segment.hotelPlan.selectedHotelId === hotelId;
  const hasOtherHotelBooked = Boolean(segment.hotelPlan.selectedHotelId && segment.hotelPlan.selectedHotelId !== hotelId);
  const images = Array.isArray(hotel.images) ? hotel.images.filter(Boolean) : [];
  const heroImage = images[activeImageIndex] || images[0];
  const roomCount = hotel.rooms?.length || 0;

  useEffect(() => {
    setActiveImageIndex(0);
    setSelectedRoomIndex(null);
  }, [hotelId]);

  const topMeta = useMemo(
    () => [
      formatDateRange(hotel.check_in, hotel.check_out),
      `${hotel.nights} noche${hotel.nights === 1 ? '' : 's'}`,
      travelerSummary,
    ].filter(Boolean),
    [hotel.check_in, hotel.check_out, hotel.nights, travelerSummary]
  );

  const [isConfirming, setIsConfirming] = useState(false);

  const handleRoomClick = (index: number) => {
    if (disabled) return;
    setSelectedRoomIndex(index);
  };

  const handleConfirmHotel = async () => {
    if (disabled || selectedRoomIndex === null) return;
    setIsConfirming(true);
    try {
      await onSelectHotel(segment.id, hotelId);
      onConfirmed?.();
    } finally {
      setIsConfirming(false);
    }
  };

  const selectedRoom = selectedRoomIndex !== null ? hotel.rooms[selectedRoomIndex] : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
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
              {distanceTag && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${DISTANCE_TAG_CLASSES[distanceTag]}`}>
                  {formatHotelDistanceLabel(distanceTag)}
                </span>
              )}
              {isSelected && (
                <Badge className="rounded-full px-3 py-1">Agregado al viaje</Badge>
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

            {selectedRoom && (
              <div className="flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Habitación seleccionada</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{selectedRoom.type || 'Estándar'}</p>
                </div>
                <p className="shrink-0 text-lg font-bold text-primary">{formatPlannerPrice(selectedRoom.total_price, selectedRoom.currency)}</p>
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
                Elegí una habitación
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
                  const isRoomSelected = selectedRoomIndex === index;
                  return (
                    <button
                      key={`${hotelId}-room-${index}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRoomClick(index)}
                      className={`w-full rounded-2xl border-2 p-3 text-left transition-all ${
                        isRoomSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/60 bg-background/80 hover:border-primary/40 hover:bg-primary/[0.02]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {room.type || `Habitación ${index + 1}`}
                            </p>
                            {isRoomSelected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          {room.description && room.description !== room.type && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {room.description}
                            </p>
                          )}
                          {typeof room.availability === 'number' && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              Disponibilidad: {room.availability}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">{totalPrice || 'Consultar'}</p>
                          {nightlyPrice && (
                            <p className="text-[11px] text-muted-foreground">{nightlyPrice}/noche</p>
                          )}
                        </div>
                      </div>
                    </button>
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
                Políticas
              </p>
              <div className="mt-4 space-y-3">
                {hotel.policy_cancellation && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Cancelación</p>
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

      {selectedRoom && (
        <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mb-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{selectedRoom.type || 'Estándar'}</span>
              <span className="font-medium text-foreground">{hotel.nights} noche{hotel.nights === 1 ? '' : 's'}</span>
            </div>
            {selectedRoom.price_per_night != null && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precio por noche</span>
                <span>{formatPlannerPrice(selectedRoom.price_per_night, selectedRoom.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-primary/20 pt-2">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-lg font-bold text-primary">{formatPlannerPrice(selectedRoom.total_price, selectedRoom.currency)}</span>
            </div>
          </div>
          {hasOtherHotelBooked && (
            <p className="mb-2 text-xs text-muted-foreground">
              Reemplaza a <span className="font-medium text-foreground">{segment.hotelPlan.confirmedInventoryHotel?.name || 'el hotel actual'}</span> en este tramo.
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={disabled || isConfirming}
            onClick={() => void handleConfirmHotel()}
          >
            {isConfirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {hasOtherHotelBooked ? 'Reemplazar hotel y presupuestar' : 'Presupuestar y agregar al itinerario'}
          </Button>
        </div>
      )}
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
          <PlannerHotelInventoryDetailBody {...props} onConfirmed={() => onOpenChange(false)} />
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
        <PlannerHotelInventoryDetailBody {...props} onConfirmed={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
