import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Check, DollarSign, Minus, Plus, Send, Users, X } from 'lucide-react';

interface PlannerAgentInputPromptProps {
  missingFields: string[];
  pendingAction?: string | null;
  onSubmit: (text: string) => void;
  onOpenDateSelector?: () => void;
}

export default function PlannerAgentInputPrompt({
  missingFields,
  pendingAction,
  onSubmit,
  onOpenDateSelector,
}: PlannerAgentInputPromptProps) {
  const [textValue, setTextValue] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  if (!missingFields.length) return null;

  const primaryField = missingFields[0];

  // Confirmation buttons (for regional expansion or destructive changes)
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
          {isItinerary ? 'Sí, armá este itinerario' : 'Confirmar'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSubmit('Quiero cambiar algo')}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Cambiar
        </Button>
      </div>
    );
  }

  // Budget selector
  if (primaryField === 'budget') {
    const options = [
      { label: 'Económico', value: 'Budget económico' },
      { label: 'Confort', value: 'Budget confort' },
      { label: 'Superior', value: 'Budget superior' },
      { label: 'Lujo', value: 'Budget lujo' },
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
          Seleccionar fechas
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
          <span className="text-xs text-muted-foreground">Adultos</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setAdults(Math.max(1, adults - 1))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-5 text-center text-sm font-medium">{adults}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setAdults(Math.min(9, adults + 1))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Niños</span>
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
          Listo
        </Button>
      </div>
    );
  }

  // Fallback: text input
  const placeholder = primaryField === 'origin'
    ? '¿Desde qué ciudad viajás?'
    : primaryField === 'destinations'
      ? '¿A qué ciudades querés ir?'
      : primaryField === 'duration'
        ? '¿Cuántos días de viaje?'
        : 'Escribí tu respuesta...';

  return (
    <form
      className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
      onSubmit={(e) => {
        e.preventDefault();
        if (textValue.trim()) {
          onSubmit(textValue.trim());
          setTextValue('');
        }
      }}
    >
      <Input
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={!textValue.trim()} className="gap-1.5">
        <Send className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
