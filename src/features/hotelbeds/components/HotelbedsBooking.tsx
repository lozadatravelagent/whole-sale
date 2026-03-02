import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { HotelbedsHotel, HotelbedsRate, HotelbedsBookingParams } from '../services/hotelbedsService';

interface Props {
  hotel: HotelbedsHotel;
  rate: HotelbedsRate;
  onBook: (params: Omit<HotelbedsBookingParams, 'rateKey'>) => void;
  onBack: () => void;
  isBooking: boolean;
}

interface PaxEntry {
  roomId: number;
  type: 'AD' | 'CH';
  name: string;
  surname: string;
  age?: number;
}

export function HotelbedsBooking({ hotel, rate, onBook, onBack, isBooking }: Props) {
  const [holderName, setHolderName] = useState('');
  const [holderSurname, setHolderSurname] = useState('');
  const [clientReference, setClientReference] = useState(`TEST-${Date.now()}`);
  const [remark, setRemark] = useState('');
  const [tolerance, setTolerance] = useState(2);

  // Build initial pax list from rate occupancy
  const buildInitialPaxes = (): PaxEntry[] => {
    const paxes: PaxEntry[] = [];
    for (let i = 0; i < (rate.adults || 2); i++) {
      paxes.push({ roomId: 1, type: 'AD', name: '', surname: '' });
    }
    for (let i = 0; i < (rate.children || 0); i++) {
      paxes.push({ roomId: 1, type: 'CH', name: '', surname: '', age: 8 });
    }
    return paxes;
  };

  const [paxes, setPaxes] = useState<PaxEntry[]>(buildInitialPaxes);

  const updatePax = (index: number, field: keyof PaxEntry, value: string | number) => {
    setPaxes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBook({
      holderName: holderName || paxes[0]?.name || 'Test',
      holderSurname: holderSurname || paxes[0]?.surname || 'Guest',
      paxes: paxes.map(p => ({
        ...p,
        name: p.name || 'Test',
        surname: p.surname || 'Guest',
      })),
      clientReference,
      remark: remark || undefined,
      tolerance,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Booking</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Summary */}
          <div className="border rounded-lg p-3 bg-muted/50 space-y-1">
            <p className="font-medium">{hotel.name}</p>
            <p className="text-sm text-muted-foreground">
              {rate.boardCode} - {rate.net} {hotel.currency}
            </p>
            <p className="text-sm text-muted-foreground">
              {rate.adults} Adults {rate.children > 0 ? `+ ${rate.children} Children` : ''}
            </p>
          </div>

          {/* Holder (lead pax) */}
          <div className="space-y-3">
            <h4 className="font-medium">Booking Holder (Lead Passenger)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input
                  value={holderName}
                  onChange={e => setHolderName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={holderSurname}
                  onChange={e => setHolderSurname(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pax Details */}
          <div className="space-y-3">
            <h4 className="font-medium">Passenger Details (Room 1)</h4>
            {paxes.map((pax, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-end">
                <div>
                  <Label className="text-xs">
                    {pax.type === 'AD' ? `Adult ${i + 1}` : `Child ${i + 1 - (rate.adults || 0)}`}
                  </Label>
                  <Input
                    value={pax.name}
                    onChange={e => updatePax(i, 'name', e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Surname</Label>
                  <Input
                    value={pax.surname}
                    onChange={e => updatePax(i, 'surname', e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Input value={pax.type === 'AD' ? 'Adult' : 'Child'} disabled />
                </div>
                {pax.type === 'CH' && (
                  <div>
                    <Label className="text-xs">Age</Label>
                    <Input
                      type="number"
                      min={2}
                      max={17}
                      value={pax.age || 8}
                      onChange={e => updatePax(i, 'age', parseInt(e.target.value) || 8)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Booking Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Client Reference</Label>
              <Input
                value={clientReference}
                onChange={e => setClientReference(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Price Tolerance (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={tolerance}
                onChange={e => setTolerance(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <Label>Remarks (optional)</Label>
            <Textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="Special requests..."
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={isBooking}>
              {isBooking ? 'Creating Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
