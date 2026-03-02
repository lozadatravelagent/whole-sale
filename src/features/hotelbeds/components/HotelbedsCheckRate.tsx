import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BOARD_LABELS, type HotelbedsCheckRateResult, type HotelbedsHotel, type HotelbedsRate } from '../services/hotelbedsService';

interface Props {
  hotel: HotelbedsHotel;
  originalRate: HotelbedsRate;
  checkRateResult: HotelbedsCheckRateResult | null;
  confirmedRate: HotelbedsRate | null;
  onProceedToBooking: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function HotelbedsCheckRate({
  hotel,
  originalRate,
  checkRateResult,
  confirmedRate,
  onProceedToBooking,
  onBack,
  isLoading,
}: Props) {
  const updatedHotel = checkRateResult?.hotel;
  const updatedRate = confirmedRate || originalRate;
  const priceChanged = confirmedRate && confirmedRate.net !== originalRate.net;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Confirmation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3">Checking rate...</span>
          </div>
        ) : (
          <>
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{updatedHotel?.name || hotel.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {updatedHotel?.categoryCode || hotel.categoryCode} | {hotel.destinationName || hotel.destinationCode}
                  </p>
                  {updatedHotel && (
                    <p className="text-sm text-muted-foreground">
                      {updatedHotel.checkIn} to {updatedHotel.checkOut}
                    </p>
                  )}
                </div>
                <Badge variant={updatedRate.rateType === 'BOOKABLE' ? 'default' : 'destructive'}>
                  {updatedRate.rateType}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Board Type</p>
                  <p className="font-medium">
                    {BOARD_LABELS[updatedRate.boardCode] || updatedRate.boardName || updatedRate.boardCode}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Price</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">{updatedRate.net} {updatedHotel?.currency || hotel.currency}</p>
                    {priceChanged && (
                      <span className="text-sm text-orange-500">
                        (was {originalRate.net})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cancellation Policies */}
              {updatedRate.cancellationPolicies && updatedRate.cancellationPolicies.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Cancellation Policies:</p>
                  {updatedRate.cancellationPolicies.map((policy, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      From {new Date(policy.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: {policy.amount} {updatedHotel?.currency || hotel.currency}
                    </p>
                  ))}
                </div>
              )}

              {/* Rate Comments - MUST be shown before booking confirmation */}
              {updatedRate.rateComments && (
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded p-3">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Rate Comments:</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">{updatedRate.rateComments}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>
                Back to Results
              </Button>
              {updatedRate.rateType === 'BOOKABLE' && (
                <Button onClick={onProceedToBooking}>
                  Proceed to Booking
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
