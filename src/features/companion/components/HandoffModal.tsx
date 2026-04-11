import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { AuthUser } from '@/contexts/AuthContext';
import { handoffFormSchema, BUDGET_LEVELS, type HandoffFormData, type HandoffBudgetLevel } from '../utils/handoffFormSchema';
import { buildHandoffDraftFromPlanner, requestHumanHandoff } from '../services/handoffService';

interface HandoffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannerState: TripPlannerState | null;
  conversationId: string | null;
  user: AuthUser | null;
  onSubmitted?: (leadId: string) => void;
}

const BUDGET_LABELS: Record<HandoffBudgetLevel, string> = {
  low: 'Económico',
  mid: 'Intermedio',
  high: 'Alto',
  luxury: 'Luxury',
};

export default function HandoffModal({
  open,
  onOpenChange,
  plannerState,
  conversationId,
  user,
  onSubmitted,
}: HandoffModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const draft = buildHandoffDraftFromPlanner(plannerState, user);

  const form = useForm<HandoffFormData>({
    resolver: zodResolver(handoffFormSchema),
    defaultValues: {
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      origin: draft.origin,
      startDate: draft.startDate,
      endDate: draft.endDate,
      adults: draft.adults,
      children: draft.children,
      budgetLevel: draft.budgetLevel,
      comment: draft.comment,
    },
  });

  // Reset form defaults whenever the modal opens with a different plannerState.
  useEffect(() => {
    if (!open) return;
    const fresh = buildHandoffDraftFromPlanner(plannerState, user);
    form.reset({
      name: fresh.name,
      email: fresh.email,
      phone: fresh.phone,
      origin: fresh.origin,
      startDate: fresh.startDate,
      endDate: fresh.endDate,
      adults: fresh.adults,
      children: fresh.children,
      budgetLevel: fresh.budgetLevel,
      comment: fresh.comment,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plannerState?.id]);

  const onSubmit = async (data: HandoffFormData) => {
    if (!plannerState || !conversationId) {
      toast({
        title: 'No se pudo enviar',
        description: 'Faltan datos del viaje o de la conversación.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await requestHumanHandoff(data, plannerState, conversationId, user);
    setIsSubmitting(false);

    if (!result) {
      toast({
        title: 'No se pudo enviar',
        description: 'Hubo un problema registrando tu pedido. Intentá nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: '¡Listo!',
      description: 'Ya le pasé tu viaje a una persona del equipo. Te contactaremos pronto.',
    });
    onSubmitted?.(result.leadId);
    onOpenChange(false);
  };

  const errors = form.formState.errors;
  const budgetLevel = form.watch('budgetLevel');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Querés que te ayude con vuelos y hoteles?</DialogTitle>
          <DialogDescription>
            Completá tus datos y alguien del equipo te contactará para armar la cotización.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="handoff-name">Nombre</Label>
              <Input id="handoff-name" {...form.register('name')} />
              {errors.name && (
                <span className="text-xs text-destructive">{errors.name.message}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-email">Email</Label>
                <Input id="handoff-email" type="email" {...form.register('email')} />
                {errors.email && (
                  <span className="text-xs text-destructive">{errors.email.message}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-phone">Teléfono</Label>
                <Input id="handoff-phone" type="tel" {...form.register('phone')} />
                {errors.phone && (
                  <span className="text-xs text-destructive">{errors.phone.message}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="handoff-origin">Ciudad de salida</Label>
              <Input
                id="handoff-origin"
                placeholder="Ej: Buenos Aires"
                {...form.register('origin')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-start">Fecha de ida</Label>
                <Input id="handoff-start" type="date" {...form.register('startDate')} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-end">Fecha de vuelta</Label>
                <Input id="handoff-end" type="date" {...form.register('endDate')} />
                {errors.endDate && (
                  <span className="text-xs text-destructive">{errors.endDate.message}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-adults">Adultos</Label>
                <Input
                  id="handoff-adults"
                  type="number"
                  min={1}
                  {...form.register('adults', { valueAsNumber: true })}
                />
                {errors.adults && (
                  <span className="text-xs text-destructive">{errors.adults.message}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-children">Niños</Label>
                <Input
                  id="handoff-children"
                  type="number"
                  min={0}
                  {...form.register('children', { valueAsNumber: true })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="handoff-budget">Presupuesto</Label>
                <Select
                  value={budgetLevel ?? ''}
                  onValueChange={(value) =>
                    form.setValue('budgetLevel', value as HandoffBudgetLevel, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="handoff-budget">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {BUDGET_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="handoff-comment">Comentario (opcional)</Label>
              <Textarea
                id="handoff-comment"
                rows={3}
                placeholder="Contanos preferencias o detalles extra…"
                {...form.register('comment')}
              />
              {errors.comment && (
                <span className="text-xs text-destructive">{errors.comment.message}</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
