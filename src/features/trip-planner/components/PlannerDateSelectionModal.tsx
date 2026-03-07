import React, { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';

interface PlannerDateSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDurationDays?: number;
  initialMonthHint?: string;
  initialSelection?: {
    startDate?: string;
    endDate?: string;
    isFlexibleDates?: boolean;
    flexibleMonth?: string;
    flexibleYear?: number;
    days?: number;
  };
  onConfirm: (selection: {
    startDate?: string;
    endDate?: string;
    isFlexibleDates: boolean;
    flexibleMonth?: string;
    flexibleYear?: number;
    days?: number;
  }) => void;
}

type DateSelectionMode = 'exact' | 'flexible';

const FLEXIBLE_DURATION_OPTIONS = [3, 5, 7, 10, 14, 21];

const MONTH_LOOKUP: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function toDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined;
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIsoDate(date?: Date): string | undefined {
  if (!date) return undefined;
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function extractMonthHint(value?: string): { month?: string; year?: number } {
  if (!value) return {};
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ');

  const matchedMonth = Object.keys(MONTH_LOOKUP)
    .sort((a, b) => b.length - a.length)
    .find((month) => normalized.includes(month));
  const yearMatch = normalized.match(/\b(20\d{2})\b/);

  return {
    month: matchedMonth ? MONTH_LOOKUP[matchedMonth] : undefined,
    year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
  };
}

function buildUpcomingMonthOptions(count = 12) {
  const now = new Date();
  now.setDate(1);
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return {
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: date.getFullYear(),
      label: date.toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
      monthLabel: date.toLocaleDateString('es-ES', {
        month: 'long',
      }),
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    };
  });
}

function calculateDays(range?: DateRange): number | undefined {
  if (!range?.from || !range?.to) return undefined;
  const from = new Date(range.from);
  const to = new Date(range.to);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
}

function buildRangeSelection(startDate?: string, endDate?: string): DateRange | undefined {
  const from = toDate(startDate);
  const to = toDate(endDate);
  if (!from && !to) return undefined;
  return { from, to };
}

export default function PlannerDateSelectionModal({
  open,
  onOpenChange,
  initialDurationDays,
  initialMonthHint,
  initialSelection,
  onConfirm,
}: PlannerDateSelectionModalProps) {
  const monthHint = useMemo(() => extractMonthHint(initialMonthHint), [initialMonthHint]);
  const monthOptions = useMemo(() => buildUpcomingMonthOptions(12), []);
  const defaultMonthOption = monthOptions.find((option) =>
    option.month === (initialSelection?.flexibleMonth || monthHint.month) &&
    option.year === (initialSelection?.flexibleYear || monthHint.year)
  ) || monthOptions[0];

  const [mode, setMode] = useState<DateSelectionMode>(initialSelection?.isFlexibleDates ? 'flexible' : 'exact');
  const [range, setRange] = useState<DateRange | undefined>(() => buildRangeSelection(initialSelection?.startDate, initialSelection?.endDate));
  const [selectedFlexibleValue, setSelectedFlexibleValue] = useState(defaultMonthOption?.value || '');
  const [flexibleDays, setFlexibleDays] = useState<number | undefined>(initialSelection?.days || initialDurationDays);

  useEffect(() => {
    if (!open) return;
    setMode(initialSelection?.isFlexibleDates ? 'flexible' : 'exact');
    setRange(buildRangeSelection(initialSelection?.startDate, initialSelection?.endDate));
    setSelectedFlexibleValue(defaultMonthOption?.value || '');
    setFlexibleDays(initialSelection?.days || initialDurationDays);
  }, [defaultMonthOption?.value, initialDurationDays, initialSelection, open]);

  const selectedDays = mode === 'exact'
    ? calculateDays(range)
    : flexibleDays;

  const exactSelectionValid = Boolean(range?.from && range?.to && range.from >= new Date(new Date().setHours(0, 0, 0, 0)));
  const flexibleSelectionValid = Boolean(selectedFlexibleValue && flexibleDays && flexibleDays > 0);

  const handleConfirm = () => {
    if (mode === 'exact') {
      if (!exactSelectionValid) return;
      onConfirm({
        startDate: toIsoDate(range?.from),
        endDate: toIsoDate(range?.to),
        isFlexibleDates: false,
        days: selectedDays,
      });
      return;
    }

    if (!flexibleSelectionValid) return;
    const [year, month] = selectedFlexibleValue.split('-');
    onConfirm({
      isFlexibleDates: true,
      flexibleMonth: month,
      flexibleYear: Number(year),
      days: flexibleDays,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trip-planner-surface max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="trip-planner-title">Definamos cuándo querés viajar</DialogTitle>
          <DialogDescription className="trip-planner-body">
            Con fechas exactas puedo mostrarte opciones reales. Si todavía estás explorando, elegí un mes flexible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <Tabs value={mode} onValueChange={(value) => setMode(value as DateSelectionMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="exact">Fechas exactas</TabsTrigger>
              <TabsTrigger value="flexible">Mes flexible</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'exact' ? (
            <div className="space-y-3 rounded-2xl border p-3">
              <p className="trip-planner-body px-2 text-xs text-muted-foreground">
                Marcá ida y vuelta para habilitar hoteles y transporte reales en el planner.
              </p>
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                defaultMonth={range?.from || toDate(initialSelection?.startDate) || new Date()}
                disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                className="planner-date-calendar p-2"
              />
              {selectedDays ? (
                <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {selectedDays} días
                  </Badge>
                  {range?.from && range?.to ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {range.from.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace(/\./g, '')}
                      {' - '}
                      {range.to.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace(/\./g, '')}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
              <div>
                <p className="trip-planner-label text-sm font-medium">Elegí un mes flexible</p>
                <p className="trip-planner-body mt-1 text-xs text-muted-foreground">
                  Si todavía no cerraste fechas, tomamos este mes como referencia y después lo ajustás.
                </p>
              </div>

              <div className="grid justify-center rounded-2xl border bg-background p-4">
                <div className="w-full max-w-[220px]">
                  <p className="trip-planner-label text-xs uppercase tracking-[0.14em] text-muted-foreground">Duración</p>
                  <Select
                    value={flexibleDays ? String(flexibleDays) : ''}
                    onValueChange={(value) => setFlexibleDays(Number(value))}
                  >
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Elegí la duración" />
                    </SelectTrigger>
                    <SelectContent>
                      {FLEXIBLE_DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option} días
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {monthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      selectedFlexibleValue === option.value
                        ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                        : 'bg-background hover:bg-muted'
                    }`}
                    onClick={() => setSelectedFlexibleValue(option.value)}
                  >
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="trip-planner-label text-sm font-medium leading-snug">
                          {option.monthLabel}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mode === 'exact' ? !exactSelectionValid : !flexibleSelectionValid}
          >
            {mode === 'exact' ? 'Usar estas fechas' : 'Usar este mes flexible'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
