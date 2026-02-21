import { Plane, Users, Timer, Luggage } from 'lucide-react';
import type { FlightData } from '@/features/chat/types/chat';
import { getCityNameFromCode, formatDuration } from '@/features/chat/utils/flightHelpers';

interface PublicFlightCardProps {
  flight: FlightData;
}

export function PublicFlightCard({ flight }: PublicFlightCardProps) {
  const { airline, price, legs, cabin, adults, childrens, infants } = flight;

  // Build passenger label
  const paxParts: string[] = [];
  if (adults > 0) paxParts.push(`${adults} adulto${adults > 1 ? 's' : ''}`);
  if (childrens > 0) paxParts.push(`${childrens} niño${childrens > 1 ? 's' : ''}`);
  if (infants > 0) paxParts.push(`${infants} infante${infants > 1 ? 's' : ''}`);

  // Extract baggage from first segment
  const firstSegment = legs[0]?.options[0]?.segments[0];
  const baggageText = firstSegment?.baggage || null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      {/* Header: airline + price */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-100">{airline.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">{airline.code}</span>
          {cabin?.class && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{cabin.brandName || cabin.class}</span>
          )}
        </div>
        <span className="text-lg font-bold text-cyan-400">
          {price.currency} {price.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
        </span>
      </div>

      {/* Passengers */}
      {paxParts.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Users className="w-3.5 h-3.5" />
          <span>{paxParts.join(', ')}</span>
        </div>
      )}

      {/* Legs */}
      {legs.map((leg) => {
        const option = leg.options[0];
        if (!option) return null;
        const segments = option.segments;
        if (!segments.length) return null;

        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];
        const legLabel = leg.legNumber === 1 ? 'IDA' : 'REGRESO';

        // Check if arrival is next day
        const isNextDay = lastSeg.arrival.date !== firstSeg.departure.date;

        return (
          <div key={leg.legNumber} className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 tracking-wider">{legLabel}</div>

            {/* Main route line */}
            <div className="flex items-center gap-3">
              {/* Departure */}
              <div className="text-center shrink-0">
                <div className="text-sm font-bold text-gray-100">{firstSeg.departure.airportCode}</div>
                <div className="text-xs text-gray-400">{firstSeg.departure.time.slice(0, 5)}</div>
                <div className="text-[10px] text-gray-500">{getCityNameFromCode(firstSeg.departure.airportCode)}</div>
              </div>

              {/* Route line */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-gray-500">{formatDuration(option.duration)}</div>
                <div className="relative w-full flex items-center">
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/60 to-cyan-500/60" />
                  <Plane className="w-3.5 h-3.5 text-cyan-400 mx-1 shrink-0" />
                  <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/60 to-blue-500/60" />
                </div>
                {segments.length > 1 && (
                  <div className="text-[10px] text-orange-400">{segments.length - 1} escala{segments.length > 2 ? 's' : ''}</div>
                )}
              </div>

              {/* Arrival */}
              <div className="text-center shrink-0">
                <div className="text-sm font-bold text-gray-100">
                  {lastSeg.arrival.airportCode}
                  {isNextDay && <span className="text-[10px] text-orange-400 ml-0.5 align-super">+1</span>}
                </div>
                <div className="text-xs text-gray-400">{lastSeg.arrival.time.slice(0, 5)}</div>
                <div className="text-[10px] text-gray-500">{getCityNameFromCode(lastSeg.arrival.airportCode)}</div>
              </div>
            </div>

            {/* Connection details */}
            {segments.length > 1 && (
              <div className="flex flex-wrap gap-2 pl-2">
                {segments.slice(0, -1).map((seg, i) => {
                  const nextSeg = segments[i + 1];
                  const arrTime = new Date(`${seg.arrival.date}T${seg.arrival.time}`);
                  const depTime = new Date(`${nextSeg.departure.date}T${nextSeg.departure.time}`);
                  const waitMinutes = Math.max(0, Math.floor((depTime.getTime() - arrTime.getTime()) / 60000));

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-orange-500/30 bg-orange-500/5 text-orange-300"
                    >
                      <Timer className="w-3 h-3" />
                      <span className="font-mono">{seg.arrival.airportCode}</span>
                      <span className="text-orange-400/70">·</span>
                      <span>{formatDuration(waitMinutes)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Baggage */}
      {baggageText && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1 border-t border-white/5">
          <Luggage className="w-3.5 h-3.5" />
          <span>{baggageText}</span>
        </div>
      )}
    </div>
  );
}
