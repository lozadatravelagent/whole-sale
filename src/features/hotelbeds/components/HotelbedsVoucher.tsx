import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BOARD_LABELS, type HotelbedsBookingResult } from '../services/hotelbedsService';

interface Props {
  booking: HotelbedsBookingResult['booking'];
  onCancel: (reference: string) => void;
  onBack: () => void;
  isCancelling: boolean;
}

export function HotelbedsVoucher({ booking, onCancel, onBack, isCancelling }: Props) {
  const hotel = booking.hotel;
  const supplier = hotel.supplier;
  const invoiceCompany = booking.invoiceCompany;

  // Extract star rating
  const stars = parseInt(hotel.categoryCode?.match(/^(\d)/)?.[1] || '0');

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Booking Voucher</CardTitle>
          <Badge variant={booking.status === 'CONFIRMED' ? 'default' : 'destructive'}>
            {booking.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Booking Reference */}
        <div className="bg-primary/10 border rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Booking Reference</p>
              <p className="text-2xl font-bold">{booking.reference}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client Reference</p>
              <p className="text-lg font-medium">{booking.clientReference}</p>
            </div>
          </div>
        </div>

        {/* Hotel Information */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Hotel Information</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span className="font-medium">{hotel.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Category: </span>
              <span>{'★'.repeat(stars)} ({hotel.categoryCode})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destination: </span>
              <span>{hotel.destinationName} ({hotel.destinationCode})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Coordinates: </span>
              <span>{hotel.latitude}, {hotel.longitude}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Check-in: </span>
              <span className="font-medium">{hotel.checkIn}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Check-out: </span>
              <span className="font-medium">{hotel.checkOut}</span>
            </div>
          </div>
        </div>

        {/* Guest Information */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Guest Information</h3>
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Holder (Lead Pax): </span>
              <span className="font-medium">{booking.holder.name} {booking.holder.surname}</span>
            </p>
          </div>
          {hotel.rooms.map((room, roomIdx) => (
            <div key={roomIdx} className="border rounded p-3 text-sm">
              <p className="font-medium">Room {roomIdx + 1}: {room.name} ({room.code})</p>
              {room.rates?.[0] && (
                <p className="text-muted-foreground">
                  Board: {BOARD_LABELS[room.rates[0].boardCode] || room.rates[0].boardName || room.rates[0].boardCode}
                  {' | '}Price: {room.rates[0].net} {hotel.currency}
                </p>
              )}
              {room.paxes && room.paxes.length > 0 && (
                <div className="mt-1">
                  <p className="text-muted-foreground">Passengers:</p>
                  <ul className="list-disc list-inside">
                    {room.paxes.map((pax, paxIdx) => (
                      <li key={paxIdx}>
                        {pax.name} {pax.surname} ({pax.type === 'AD' ? 'Adult' : `Child, age ${pax.age}`})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Rate Comments */}
              {room.rates?.[0]?.rateComments && (
                <div className="mt-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded p-2">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Rate Comments:</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">{room.rates[0].rateComments}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Pricing</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Total Net: </span>
              <span className="font-bold text-lg">{booking.totalNet} {booking.currency}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pending Amount: </span>
              <span>{booking.pendingAmount} {booking.currency}</span>
            </div>
          </div>
        </div>

        {/* Payment Disclaimer (CERTIFICATION REQUIREMENT) */}
        <div className="bg-muted border rounded-lg p-4 text-sm">
          <p className="font-medium mb-1">Payment Information</p>
          <p className="text-muted-foreground">
            Payable through {supplier?.name || 'Hotelbeds S.L.U.'}, acting as agent for the service
            operating company.{' '}
            {supplier?.vatNumber && <>VAT: {supplier.vatNumber}. </>}
            {invoiceCompany?.registrationNumber && (
              <>Registration: {invoiceCompany.registrationNumber}. </>
            )}
            Reference: {booking.reference}
          </p>
        </div>

        {/* Modification Policies */}
        {booking.modificationPolicies && (
          <div className="text-sm">
            <p className="text-muted-foreground">
              Cancellation: {booking.modificationPolicies.cancellation ? 'Allowed' : 'Not allowed'}
              {' | '}
              Modification: {booking.modificationPolicies.modification ? 'Allowed' : 'Not allowed'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back to Results
          </Button>
          {booking.modificationPolicies?.cancellation && (
            <Button
              variant="destructive"
              onClick={() => onCancel(booking.reference)}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
