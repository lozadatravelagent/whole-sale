import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Check, ChevronRight, FileDown, Loader2, X } from 'lucide-react';
import type { PlannerBudgetLevel, PlannerFieldProvenance, PlannerPace, PlannerSyncingFields, TripPlannerState } from '../types';
import LeadSelector from './LeadSelector';

const BUDGET_OPTIONS: { value: PlannerBudgetLevel; label: string; icon: string }[] = [
  { value: 'low', label: 'Bajo', icon: '$' },
  { value: 'mid', label: 'Medio', icon: '$$' },
  { value: 'high', label: 'Alto', icon: '$$$' },
  { value: 'luxury', label: 'Lujo', icon: '$$$$' },
];

const PACE_OPTIONS: { value: PlannerPace; label: string; icon: string }[] = [
  { value: 'relaxed', label: 'Relajado', icon: '\u{1F9D8}' },
  { value: 'balanced', label: 'Equilibrado', icon: '\u{2696}\u{FE0F}' },
  { value: 'fast', label: 'Intenso', icon: '\u{26A1}' },
];

interface TripSpecsBarProps {
  plannerState: TripPlannerState;
  isDraft: boolean;
  dateSummary: string;
  hasExactDates: boolean;
  isAssumed: (field: keyof PlannerFieldProvenance) => boolean;
  fieldIsSyncing: (field: keyof PlannerSyncingFields) => boolean;
  showAssumedBanner: boolean;
  onDismissAssumedBanner: () => void;
  activePanel: 'destinations' | 'trips' | null;
  onToggleDestinations: () => void;
  onToggleTrips: () => void;
  onUpdateBudget: (value: PlannerBudgetLevel) => void;
  onUpdatePace: (value: PlannerPace) => void;
  onOpenDateSelector: () => void;
  onUpdateDays: (days: number) => void;
  onExportPdf: () => void;
  linkedLead: { id: string; name: string } | null;
  onSelectLead: (leadId: string, leadName: string) => Promise<void>;
  onClearLead: () => Promise<void>;
  draftProgress: { label: string; description: string; generating?: boolean; originMessage?: string } | null;
  loadingPhase: { steps: Array<{ label: string; status: 'done' | 'active' | 'pending' }> } | null;
}

export default function TripSpecsBar({
  plannerState, isDraft, dateSummary, hasExactDates,
  isAssumed, fieldIsSyncing, showAssumedBanner, onDismissAssumedBanner,
  activePanel, onToggleDestinations, onToggleTrips,
  onUpdateBudget, onUpdatePace, onOpenDateSelector, onUpdateDays, onExportPdf,
  linkedLead, onSelectLead, onClearLead,
  draftProgress, loadingPhase,
}: TripSpecsBarProps) {
  return (
    <div className="space-y-2">
      {/* Pills row — single line, horizontal scroll */}
      <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Destinations */}
        <button type="button" onClick={onToggleDestinations} disabled={isDraft}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${activePanel === 'destinations' ? 'bg-foreground text-background shadow-sm' : 'text-foreground hover:bg-muted'} ${isDraft ? 'cursor-default opacity-80' : ''}`}>
          <span>{plannerState.segments.length} destinos</span>
          <ChevronRight className={`h-4 w-4 transition ${activePanel === 'destinations' ? 'rotate-90' : ''}`} />
        </button>

        {/* Trips */}
        <button type="button" onClick={onToggleTrips}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition whitespace-nowrap ${activePanel === 'trips' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>
          🗺️ Trips
        </button>

        {/* Lead */}
        <div className="shrink-0">
          <LeadSelector value={linkedLead?.id ?? null} leadName={linkedLead?.name} onSelect={onSelectLead} onClear={onClearLead} />
        </div>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />

        {/* Dates */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" disabled={isDraft} onClick={onOpenDateSelector}
                className={`relative flex shrink-0 min-w-[10.75rem] items-center rounded-full px-4 py-2 text-left text-sm font-medium transition whitespace-nowrap xl:min-w-[11.5rem] ${isAssumed('startDate') ? 'ring-1 ring-amber-300/60' : ''} ${isDraft ? 'cursor-default opacity-80' : 'text-foreground hover:bg-muted'}`}>
                {fieldIsSyncing('dates') ? <Loader2 className="absolute -top-1 -right-1 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('startDate') && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                {dateSummary}
              </button>
            </TooltipTrigger>
            {isAssumed('startDate') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />

        {/* Days */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`relative flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('days') ? 'ring-1 ring-amber-300/60' : ''}`}>
                {fieldIsSyncing('dates') ? <Loader2 className="absolute -top-1 -right-1 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('days') && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                {hasExactDates ? (
                  <span>{plannerState.days} días</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} value={plannerState.days}
                      onChange={(e) => onUpdateDays(Math.max(1, Number(e.target.value) || 1))}
                      disabled={isDraft}
                      className="h-7 w-14 border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0" />
                    <span>días</span>
                  </div>
                )}
              </div>
            </TooltipTrigger>
            {isAssumed('days') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />

        {/* Budget */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`relative flex shrink-0 items-center gap-1 rounded-full p-0.5 ${isAssumed('budgetLevel') ? 'ring-1 ring-amber-300/60' : ''}`}>
                {fieldIsSyncing('budgetLevel') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('budgetLevel') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                {BUDGET_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" disabled={isDraft} onClick={() => onUpdateBudget(opt.value)}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${(plannerState.budgetLevel || 'mid') === opt.value ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${isDraft ? 'cursor-default opacity-80' : ''}`}>
                    <span className="mr-0.5">{opt.icon}</span>
                  </button>
                ))}
              </div>
            </TooltipTrigger>
            {isAssumed('budgetLevel') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />

        {/* Pace */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`relative flex shrink-0 items-center gap-1 rounded-full p-0.5 ${isAssumed('pace') ? 'ring-1 ring-amber-300/60' : ''}`}>
                {fieldIsSyncing('pace') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('pace') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                {PACE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" disabled={isDraft} onClick={() => onUpdatePace(opt.value)}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${(plannerState.pace || 'balanced') === opt.value ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${isDraft ? 'cursor-default opacity-80' : ''}`}>
                    <span className="mr-0.5">{opt.icon}</span>
                  </button>
                ))}
              </div>
            </TooltipTrigger>
            {isAssumed('pace') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />

        {/* Travelers */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('travelers') ? 'ring-1 ring-amber-300/60' : ''}`}>
                {fieldIsSyncing('travelers') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('travelers') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                <span>{plannerState.travelers.adults} adulto{plannerState.travelers.adults !== 1 ? 's' : ''}{plannerState.travelers.children > 0 ? `, ${plannerState.travelers.children} niño${plannerState.travelers.children !== 1 ? 's' : ''}` : ''}{plannerState.travelers.infants > 0 ? `, ${plannerState.travelers.infants} bebé${plannerState.travelers.infants !== 1 ? 's' : ''}` : ''}</span>
              </div>
            </TooltipTrigger>
            {isAssumed('travelers') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        {/* Origin */}
        {plannerState.origin && (
          <>
            <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('origin') ? 'ring-1 ring-amber-300/60' : ''}`}>
                    {isAssumed('origin') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                    <span>Desde {plannerState.origin}</span>
                  </div>
                </TooltipTrigger>
                {isAssumed('origin') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Spacer + Export */}
        <div className="ml-auto shrink-0" />
        <button type="button" disabled={isDraft} onClick={onExportPdf}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${isDraft ? 'cursor-default opacity-80' : 'text-foreground hover:bg-muted'}`}>
          <FileDown className="h-4 w-4" />
          <span className="hidden xl:inline">Exportar PDF</span>
        </button>
      </div>

      {/* Assumed banner */}
      {showAssumedBanner && (
        <Alert className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
          <AlertDescription className="flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
            <span>Algunos valores fueron estimados. Los campos con borde naranja son sugeridos — hacé clic para confirmarlos.</span>
            <button type="button" onClick={onDismissAssumedBanner} className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Seasonality alert */}
      {plannerState.seasonalityAlert && !isDraft && (
        <Alert className="border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20">
          <AlertDescription className="flex items-center gap-2 text-xs text-orange-800 dark:text-orange-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{plannerState.seasonalityAlert}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Draft progress */}
      {draftProgress && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">{draftProgress.label}</Badge>
            {draftProgress.originMessage && (
              <span className="trip-planner-body text-xs text-muted-foreground">{draftProgress.originMessage}</span>
            )}
          </div>
          <p className="trip-planner-body mt-2 text-xs text-muted-foreground">{draftProgress.description}</p>
          {draftProgress.generating && (
            <div className="mt-2.5 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">Generando itinerario...</span>
            </div>
          )}
        </div>
      )}

      {/* Loading steps */}
      {!draftProgress && loadingPhase && loadingPhase.steps.length > 0 && (
        <div className="planner-panel-fade-in rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {loadingPhase.steps.map((step) => (
              <span key={step.label} className="flex items-center gap-1.5 text-xs">
                {step.status === 'done' ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15"><Check className="h-2.5 w-2.5 text-primary" /></span>
                ) : step.status === 'active' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                )}
                <span className={`trip-planner-body ${step.status === 'active' ? 'font-medium text-foreground' : step.status === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  {step.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
