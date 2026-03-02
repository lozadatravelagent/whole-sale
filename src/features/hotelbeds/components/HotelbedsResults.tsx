import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BOARD_LABELS, type HotelbedsHotel, type HotelbedsRate } from '../services/hotelbedsService';

interface Props {
  hotels: HotelbedsHotel[];
  totalFiltered: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelectRate: (hotel: HotelbedsHotel, rate: HotelbedsRate) => void;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    minStars?: number;
    maxStars?: number;
    boardCode?: string;
  };
  onFiltersChange: (filters: Props['filters']) => void;
}

function getStars(categoryCode: string): number {
  const match = categoryCode?.match(/^(\d)/);
  return match ? parseInt(match[1]) : 0;
}

function formatCancellationPolicies(policies?: Array<{ amount: string; from: string }>): string {
  if (!policies || policies.length === 0) return 'No cancellation policy available';
  return policies
    .map(p => {
      const date = new Date(p.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `From ${date}: ${p.amount}`;
    })
    .join(' | ');
}

export function HotelbedsResults({
  hotels,
  totalFiltered,
  totalPages,
  currentPage,
  onPageChange,
  onSelectRate,
  filters,
  onFiltersChange,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters ({totalFiltered} hotels)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Min Price</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minPrice ?? ''}
                onChange={e => onFiltersChange({ ...filters, minPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div>
              <Label className="text-xs">Max Price</Label>
              <Input
                type="number"
                placeholder="Any"
                value={filters.maxPrice ?? ''}
                onChange={e => onFiltersChange({ ...filters, maxPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div>
              <Label className="text-xs">Min Stars</Label>
              <Select
                value={String(filters.minStars ?? '__any__')}
                onValueChange={v => onFiltersChange({ ...filters, minStars: v === '__any__' ? undefined : parseInt(v) })}
              >
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {[1, 2, 3, 4, 5].map(s => (
                    <SelectItem key={s} value={String(s)}>{s} star{s > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Stars</Label>
              <Select
                value={String(filters.maxStars ?? '__any__')}
                onValueChange={v => onFiltersChange({ ...filters, maxStars: v === '__any__' ? undefined : parseInt(v) })}
              >
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {[1, 2, 3, 4, 5].map(s => (
                    <SelectItem key={s} value={String(s)}>{s} star{s > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Board Type</Label>
              <Select
                value={filters.boardCode ?? '__any__'}
                onValueChange={v => onFiltersChange({ ...filters, boardCode: v === '__any__' ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {Object.entries(BOARD_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>{code} - {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hotel Cards */}
      {hotels.map((hotel) => {
        const stars = getStars(hotel.categoryCode);
        return (
          <Card key={hotel.code} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{hotel.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-yellow-500">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                    <span className="text-sm text-muted-foreground">{hotel.categoryCode}</span>
                    <span className="text-sm text-muted-foreground">| {hotel.destinationName || hotel.destinationCode}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="text-xl font-bold">{hotel.minRate} {hotel.currency}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hotel.rooms.map((room) => (
                  <div key={room.code} className="border rounded-lg p-3">
                    <p className="font-medium text-sm mb-2">{room.name} ({room.code})</p>
                    <div className="space-y-2">
                      {room.rates.map((rate, rateIdx) => (
                        <div key={rateIdx} className="flex items-start justify-between gap-4 p-2 bg-muted/50 rounded">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={rate.rateType === 'BOOKABLE' ? 'default' : 'secondary'}>
                                {rate.rateType}
                              </Badge>
                              <span className="text-sm font-medium">
                                {BOARD_LABELS[rate.boardCode] || rate.boardName || rate.boardCode}
                              </span>
                              {rate.packaging && <Badge variant="outline">Package</Badge>}
                            </div>
                            <p className="text-lg font-bold">{rate.net} {hotel.currency}</p>
                            {rate.sellingRate && (
                              <p className="text-sm text-muted-foreground">Selling: {rate.sellingRate} {hotel.currency}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Allotment: {rate.allotment} | {rate.adults} AD {rate.children > 0 ? `+ ${rate.children} CH` : ''}
                            </p>
                            {/* Cancellation Policies */}
                            <p className="text-xs text-muted-foreground">
                              Cancellation: {formatCancellationPolicies(rate.cancellationPolicies)}
                            </p>
                            {/* Rate Comments */}
                            {rate.rateComments && (
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                Rate comments: {rate.rateComments}
                              </p>
                            )}
                            {/* Promotions */}
                            {rate.promotions && rate.promotions.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {rate.promotions.map((promo, i) => (
                                  <Badge key={i} variant="outline" className="text-green-600 border-green-600">
                                    {promo.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => onSelectRate(hotel, rate)}
                          >
                            {rate.rateType === 'RECHECK' ? 'Check Rate' : 'Book'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
