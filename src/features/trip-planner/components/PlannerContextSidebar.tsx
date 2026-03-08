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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Hotel, PanelRightClose, Plane } from 'lucide-react';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { PlannerSegment, TripPlannerState } from '../types';
import { formatDateRange, formatDestinationLabel } from '../utils';
import {
  PlannerHotelInventoryDetailBody,
} from './PlannerHotelInventoryDetailPanel';
import PlannerHotelInventorySection from './PlannerHotelInventorySection';
import PlannerTransportSection from './PlannerTransportSection';
import { PlannerPlaceDetailBody, type PlaceDetailData } from './PlannerPlaceDetailPanel';

interface PlannerContextSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHideSidebar: () => void;
  segment: PlannerSegment | null;
  previousSegment?: PlannerSegment | null;
  activeTab: 'hotels' | 'transport';
  onTabChange: (tab: 'hotels' | 'transport') => void;
  activeHotel: LocalHotelData | null;
  onBackFromHotelDetail: () => void;
  headerImageUrl?: string;
  hasExactDates: boolean;
  disabled?: boolean;
  travelers?: TripPlannerState['travelers'];
  hotelStatusText: string;
  transportStatusText: string;
  onOpenHotelDetail: (segmentId: string, hotelId: string) => void;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onSelectTransportOption: (segmentId: string, optionId: string) => Promise<void>;
  activePlace?: PlaceDetailData | null;
  onBackFromPlaceDetail?: () => void;
  onAddPlaceToItinerary?: () => void;
  canAddPlace?: boolean;
}

function getSegmentHeroImage(segment: PlannerSegment, headerImageUrl?: string): string | undefined {
  const confirmedHotelImage = segment.hotelPlan.confirmedInventoryHotel?.images?.find(Boolean);
  if (confirmedHotelImage) return confirmedHotelImage;

  const selectedPlaceImage = segment.hotelPlan.selectedPlaceCandidate?.photoUrls?.find(Boolean);
  if (selectedPlaceImage) return selectedPlaceImage;

  const recommendedHotelImage = segment.hotelPlan.hotelRecommendations
    .flatMap((hotel) => hotel.images || [])
    .find(Boolean);
  if (recommendedHotelImage) return recommendedHotelImage;

  const activityImage = segment.days
    .flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening])
    .flatMap((activity) => activity.photoUrls || [])
    .find((url) => url && url !== headerImageUrl);
  if (activityImage) return activityImage;

  return undefined;
}

function PlannerContextSidebarContent({
  segment,
  previousSegment = null,
  activeTab,
  onTabChange,
  activeHotel,
  onHideSidebar,
  onBackFromHotelDetail,
  headerImageUrl,
  hasExactDates,
  disabled = false,
  travelers,
  hotelStatusText,
  transportStatusText,
  onOpenHotelDetail,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
  onSelectHotel,
  onSelectTransportOption,
  activePlace,
  onBackFromPlaceDetail,
  onAddPlaceToItinerary,
  canAddPlace,
}: Omit<PlannerContextSidebarProps, 'open' | 'onOpenChange'>) {
  if (!segment) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Contexto del viaje
          </Badge>
          <p className="trip-planner-title text-lg font-semibold text-foreground">
            Elegí un destino para abrir hoteles o transporte
          </p>
          <p className="trip-planner-body text-sm text-muted-foreground">
            Esta sidebar concentra la operación del tramo activo sin agregar otra columna al planner.
          </p>
        </div>
      </div>
    );
  }

  if (activePlace) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full bg-background/90 p-0 shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={onHideSidebar}
              aria-label="Ocultar sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-1 h-8 px-2"
              onClick={onBackFromPlaceDetail}
            >
              Volver
            </Button>
          </div>
        </div>
        <PlannerPlaceDetailBody
          data={activePlace}
          onAddToItinerary={onAddPlaceToItinerary}
          canAdd={canAddPlace}
        />
      </div>
    );
  }

  if (activeHotel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full bg-background/90 p-0 shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={onHideSidebar}
              aria-label="Ocultar sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-1 h-8 px-2"
              onClick={onBackFromHotelDetail}
            >
              Volver a hoteles
            </Button>
          </div>
        </div>
        <PlannerHotelInventoryDetailBody
          hotel={activeHotel}
          segment={segment}
          hasExactDates={hasExactDates}
          disabled={disabled}
          onSelectHotel={onSelectHotel}
          onRefreshQuotedHotel={onRefreshQuotedHotel}
        />
      </div>
    );
  }

  const canShowTransport = Boolean(previousSegment);
  const heroImage = getSegmentHeroImage(segment, headerImageUrl);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative overflow-hidden border-b border-border/70">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute left-4 top-4 z-20 h-10 w-10 rounded-full bg-background/88 p-0 shadow-sm backdrop-blur-md hover:bg-background"
          onClick={onHideSidebar}
          aria-label="Ocultar sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>

        <div className="relative h-56">
          {heroImage ? (
            <img
              src={heroImage}
              alt={formatDestinationLabel(segment.city)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#60a5fa_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/70" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-3xl font-semibold tracking-tight text-white">
              {formatDestinationLabel(segment.city)}
            </p>
            <p className="mt-1.5 text-sm text-white/80">
              {formatDateRange(segment.startDate, segment.endDate)}
              {segment.nights != null && <> · {segment.nights} noche{segment.nights === 1 ? '' : 's'}</>}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'hotels' | 'transport')} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/70 px-4 py-3 sm:px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hotels" className="gap-2">
              <Hotel className="h-4 w-4" />
              Hoteles
            </TabsTrigger>
            <TabsTrigger value="transport" className="gap-2" disabled={!canShowTransport}>
              <Plane className="h-4 w-4" />
              Transporte
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <TabsContent value="hotels" className="mt-0 space-y-4">
            <PlannerHotelInventorySection
              segment={segment}
              hasExactDates={hasExactDates}
              disabled={disabled}
              travelers={travelers}
              statusText={hotelStatusText}
              onOpenHotelDetail={onOpenHotelDetail}
              onResolveInventoryMatch={onResolveInventoryMatch}
              onConfirmInventoryHotelMatch={onConfirmInventoryHotelMatch}
              onRefreshQuotedHotel={onRefreshQuotedHotel}
            />
          </TabsContent>

          <TabsContent value="transport" className="mt-0 space-y-4">
            <PlannerTransportSection
              segment={segment}
              previousSegment={previousSegment}
              disabled={disabled}
              statusText={transportStatusText}
              onSelectTransportOption={onSelectTransportOption}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function PlannerContextSidebar(props: PlannerContextSidebarProps) {
  const {
    open,
    onOpenChange,
    onHideSidebar,
    segment,
    activeHotel,
    activePlace,
  } = props;
  const isMobile = useIsMobile();

  const title = activePlace?.place?.name
    || (activeHotel
      ? activeHotel.name
      : segment
        ? formatDestinationLabel(segment.city)
        : 'Detalle del viaje');
  const description = activePlace?.place?.name
    ? `${segment?.city || ''} · ${activePlace.place.formattedAddress || ''}`
    : activeHotel
      ? `${segment?.city || ''} · ${formatDateRange(activeHotel.check_in, activeHotel.check_out)}`
      : segment
        ? 'Hoteles de inventario y transporte del tramo activo'
        : 'Elegí un destino para revisar la operación del viaje.';

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="sr-only px-4 pt-4 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <PlannerContextSidebarContent {...props} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl lg:max-w-2xl [&>button]:hidden">
        <SheetHeader className="sr-only border-b border-border/70 px-6 py-5 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <PlannerContextSidebarContent {...props} />
      </SheetContent>
    </Sheet>
  );
}
