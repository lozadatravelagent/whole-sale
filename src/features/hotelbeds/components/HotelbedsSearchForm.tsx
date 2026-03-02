import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HotelbedsSearchParams } from '../services/hotelbedsService';

interface Props {
  onSearch: (params: HotelbedsSearchParams) => void;
  isSearching: boolean;
}

export function HotelbedsSearchForm({ onSearch, isSearching }: Props) {
  const [destination, setDestination] = useState('PMI');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  // Default dates: 6+ months from now (for certification test booking)
  const getDefaultCheckIn = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 7);
    return d.toISOString().split('T')[0];
  };

  const getDefaultCheckOut = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 7);
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  };

  const handleChildrenChange = (count: number) => {
    setChildren(count);
    setChildrenAges(prev => {
      const ages = [...prev];
      while (ages.length < count) ages.push(8);
      return ages.slice(0, count);
    });
  };

  const handleChildAgeChange = (index: number, age: number) => {
    setChildrenAges(prev => {
      const ages = [...prev];
      ages[index] = age;
      return ages;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      destination,
      checkIn: checkIn || getDefaultCheckIn(),
      checkOut: checkOut || getDefaultCheckOut(),
      adults,
      children,
      childrenAges: childrenAges.slice(0, children),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hotel Availability Search</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="destination">Destination Code</Label>
              <Input
                id="destination"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="e.g. PMI, BCN, MAD"
              />
              <p className="text-xs text-muted-foreground mt-1">Hotelbeds destination code</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="checkIn">Check-in</Label>
                <Input
                  id="checkIn"
                  type="date"
                  value={checkIn || getDefaultCheckIn()}
                  onChange={e => setCheckIn(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="checkOut">Check-out</Label>
                <Input
                  id="checkOut"
                  type="date"
                  value={checkOut || getDefaultCheckOut()}
                  onChange={e => setCheckOut(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={6}
                value={adults}
                onChange={e => setAdults(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="children">Children (2-17)</Label>
              <Input
                id="children"
                type="number"
                min={0}
                max={4}
                value={children}
                onChange={e => handleChildrenChange(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {children > 0 && (
            <div className="space-y-2">
              <Label>Children Ages</Label>
              <div className="flex gap-2">
                {Array.from({ length: children }).map((_, i) => (
                  <Input
                    key={i}
                    type="number"
                    min={2}
                    max={17}
                    value={childrenAges[i] || 8}
                    onChange={e => handleChildAgeChange(i, parseInt(e.target.value) || 8)}
                    className="w-20"
                    placeholder={`Child ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          <Button type="submit" disabled={isSearching} className="w-full">
            {isSearching ? 'Searching...' : 'Search Availability'}
          </Button>

          <p className="text-xs text-muted-foreground">
            Certification test: Use dates 6+ months in the future, 2 adults + 2 children, avoid non-refundable rates.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
