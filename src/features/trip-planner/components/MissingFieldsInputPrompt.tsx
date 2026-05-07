import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar, Check, DollarSign, Minus, Plus, Users, X } from 'lucide-react';

interface MissingFieldsInputPromptProps {
  missingFields: string[];
  pendingAction?: string | null;
  onSubmit: (text: string) => void;
  onOpenDateSelector?: () => void;
}

export default function MissingFieldsInputPrompt({
  missingFields,
  pendingAction,
  onSubmit,
  onOpenDateSelector,
}: MissingFieldsInputPromptProps) {
  const { t } = useTranslation('chat');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  if (!missingFields.length) return null;

  const primaryField = missingFields[0];

  // Confirmation buttons (for regional expansion or destructive changes).
  // The values passed to onSubmit stay in Spanish — they are signals consumed by
  // the AI parser, not user-facing copy.
  if (primaryField === 'confirmation') {
    const isItinerary = pendingAction === 'generate_itinerary';
    return (
      <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <Button
          size="sm"
          onClick={() => onSubmit(isItinerary ? 'Sí, armá este itinerario' : 'Sí, confirmar')}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {isItinerary
            ? t('missingFieldsPrompt.confirm.itinerary')
            : t('missingFieldsPrompt.confirm.generic')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSubmit('Quiero cambiar algo')}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          {t('missingFieldsPrompt.confirm.cancel')}
        </Button>
      </div>
    );
  }

  // Budget selector
  if (primaryField === 'budget') {
    const options = [
      { label: t('missingFieldsPrompt.budget.economy'), value: 'Budget económico' },
      { label: t('missingFieldsPrompt.budget.comfort'), value: 'Budget confort' },
      { label: t('missingFieldsPrompt.budget.superior'), value: 'Budget superior' },
      { label: t('missingFieldsPrompt.budget.luxury'), value: 'Budget lujo' },
    ];
    return (
      <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {options.map((opt) => (
          <Button
            key={opt.value}
            variant="outline"
            size="sm"
            onClick={() => onSubmit(opt.value)}
            className="gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5" />
            {opt.label}
          </Button>
        ))}
      </div>
    );
  }

  // Date selector (delegate to existing modal)
  if (primaryField === 'dates') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDateSelector}
          className="gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" />
          {t('missingFieldsPrompt.dates.cta')}
        </Button>
      </div>
    );
  }

  // Passengers stepper
  if (primaryField === 'passengers') {
    return (
      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('missingFieldsPrompt.passengers.adults')}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setAdults(Math.max(1, adults - 1))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-5 text-center text-sm font-medium">{adults}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setAdults(Math.min(9, adults + 1))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('missingFieldsPrompt.passengers.children')}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setChildren(Math.max(0, children - 1))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-5 text-center text-sm font-medium">{children}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setChildren(Math.min(9, children + 1))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => onSubmit(`${adults} adulto${adults !== 1 ? 's' : ''}${children > 0 ? ` y ${children} niño${children !== 1 ? 's' : ''}` : ''}`)}
        >
          {t('missingFieldsPrompt.passengers.submit')}
        </Button>
      </div>
    );
  }

  return null;
}
