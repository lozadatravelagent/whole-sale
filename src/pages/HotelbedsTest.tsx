import { useHotelbedsSearch } from '@/features/hotelbeds/hooks/useHotelbedsSearch';
import { HotelbedsSearchForm } from '@/features/hotelbeds/components/HotelbedsSearchForm';
import { HotelbedsResults } from '@/features/hotelbeds/components/HotelbedsResults';
import { HotelbedsCheckRate } from '@/features/hotelbeds/components/HotelbedsCheckRate';
import { HotelbedsBooking } from '@/features/hotelbeds/components/HotelbedsBooking';
import { HotelbedsVoucher } from '@/features/hotelbeds/components/HotelbedsVoucher';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function HotelbedsTest() {
  const hb = useHotelbedsSearch();

  const { hotels, totalPages, totalFiltered } = hb.getPaginatedHotels();

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Hotelbeds Certification Test</h1>
          <p className="text-muted-foreground text-sm">
            Full booking workflow: Availability → CheckRate → Booking → Voucher → Cancel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Workflow: {hb.workflow}</Badge>
          {hb.workflow !== 'IDLE' && (
            <Button variant="ghost" size="sm" onClick={hb.reset}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {hb.error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-destructive font-medium">Error: {hb.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={hb.reset}>
              Start Over
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Search Form (always visible in IDLE state) */}
      {(hb.workflow === 'IDLE' || hb.workflow === 'ERROR') && (
        <HotelbedsSearchForm
          onSearch={hb.search}
          isSearching={hb.workflow === 'SEARCHING'}
        />
      )}

      {/* Loading state */}
      {hb.workflow === 'SEARCHING' && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3">Searching availability...</span>
          </CardContent>
        </Card>
      )}

      {/* Step 1 Results: Hotel Availability */}
      {hb.workflow === 'RESULTS' && (
        <HotelbedsResults
          hotels={hotels}
          totalFiltered={totalFiltered}
          totalPages={totalPages}
          currentPage={hb.currentPage}
          onPageChange={hb.setPage}
          onSelectRate={(hotel, rate) => hb.doCheckRate(hotel, rate)}
          filters={hb.filters}
          onFiltersChange={hb.setFilters}
        />
      )}

      {/* Step 2: CheckRate */}
      {(hb.workflow === 'CHECK_RATE' || hb.workflow === 'RATE_CONFIRMED') && hb.selectedHotel && hb.selectedRate && (
        <HotelbedsCheckRate
          hotel={hb.selectedHotel}
          originalRate={hb.selectedRate}
          checkRateResult={hb.checkRateResult}
          confirmedRate={hb.selectedRate}
          onProceedToBooking={() => {
            // Transition managed by workflow state
            // When user clicks "Proceed to Booking" we go to RATE_CONFIRMED → Booking form
          }}
          onBack={hb.reset}
          isLoading={hb.workflow === 'CHECK_RATE'}
        />
      )}

      {/* Step 3: Booking Form */}
      {hb.workflow === 'RATE_CONFIRMED' && hb.selectedHotel && hb.selectedRate && (
        <HotelbedsBooking
          hotel={hb.selectedHotel}
          rate={hb.selectedRate}
          onBook={hb.doBooking}
          onBack={hb.reset}
          isBooking={false}
        />
      )}

      {/* Booking in progress */}
      {hb.workflow === 'BOOKING' && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3">Creating booking (60s timeout)...</span>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Booking Confirmed → Voucher */}
      {(hb.workflow === 'BOOKED' || hb.workflow === 'VOUCHER') && hb.bookingResult && (
        (() => {
          const booking = hb.bookingResult.booking || hb.bookingResult;
          if (!booking?.reference && !booking?.hotel) {
            return (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="font-medium">Booking created but unexpected response format:</p>
                  <pre className="text-xs overflow-auto max-h-96 bg-muted p-3 rounded">
                    {JSON.stringify(hb.bookingResult, null, 2)}
                  </pre>
                  <Button onClick={hb.reset}>Start Over</Button>
                </CardContent>
              </Card>
            );
          }
          return (
            <HotelbedsVoucher
              booking={booking}
              onCancel={hb.doCancel}
              onBack={hb.reset}
              isCancelling={hb.workflow === 'CANCELLING'}
            />
          );
        })()
      )}

      {/* Cancellation in progress */}
      {hb.workflow === 'CANCELLING' && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3">Cancelling booking...</span>
          </CardContent>
        </Card>
      )}

      {/* Cancelled */}
      {hb.workflow === 'CANCELLED' && hb.cancelResult && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">CANCELLED</Badge>
              <span className="font-medium">Booking successfully cancelled</span>
            </div>
            <div className="text-sm space-y-1">
              <p>Booking Reference: {hb.cancelResult.booking.reference}</p>
              <p>Cancellation Reference: {hb.cancelResult.booking.cancellationReference}</p>
              <p>Client Reference: {hb.cancelResult.booking.clientReference}</p>
              <p>Status: {hb.cancelResult.booking.status}</p>
            </div>
            <Button onClick={hb.reset}>Start New Search</Button>
          </CardContent>
        </Card>
      )}

      {/* Workflow Status Bar */}
      <div className="border rounded-lg p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Certification Workflow Status</p>
        <div className="flex gap-1 flex-wrap">
          {(['IDLE', 'SEARCHING', 'RESULTS', 'CHECK_RATE', 'RATE_CONFIRMED', 'BOOKING', 'BOOKED', 'VOUCHER', 'CANCELLED'] as const).map(step => (
            <Badge
              key={step}
              variant={hb.workflow === step ? 'default' : 'outline'}
              className="text-xs"
            >
              {step}
            </Badge>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          <p>GZIP: Enabled (Accept-Encoding: gzip header on all requests)</p>
          <p>Booking Timeout: 60 seconds minimum</p>
          <p>CheckRate: Only sent when rateType === 'RECHECK'</p>
          <p>Booking: Only sent when rateType === 'BOOKABLE'</p>
          <p>RateKey: Treated as opaque string, never parsed</p>
        </div>
      </div>
    </div>
  );
}
