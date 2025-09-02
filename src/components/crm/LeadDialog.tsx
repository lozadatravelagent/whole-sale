import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, Users, Phone, Mail, FileText, User } from 'lucide-react';
import { Lead, LeadStatus } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

const leadSchema = z.object({
  contact: z.object({
    name: z.string().min(1, 'Nombre requerido'),
    phone: z.string().min(1, 'Teléfono requerido'),
    email: z.string().email('Email inválido').optional().or(z.literal(''))
  }),
  trip: z.object({
    type: z.enum(['hotel', 'flight', 'package']),
    city: z.string().min(1, 'Ciudad requerida'),
    dates: z.object({
      checkin: z.string().min(1, 'Fecha de entrada requerida'),
      checkout: z.string().min(1, 'Fecha de salida requerida')
    }),
    adults: z.number().min(1, 'Mínimo 1 adulto'),
    children: z.number().min(0, 'No puede ser negativo')
  }),
  status: z.enum(['new', 'quoted', 'negotiating', 'won', 'lost'])
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSave: (data: LeadFormData) => void;
  isEditing?: boolean;
}

export function LeadDialog({ open, onOpenChange, lead, onSave, isEditing = false }: LeadDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ? {
      contact: lead.contact,
      trip: lead.trip,
      status: lead.status
    } : {
      contact: { name: '', phone: '', email: '' },
      trip: { 
        type: 'hotel',
        city: '',
        dates: { checkin: '', checkout: '' },
        adults: 1,
        children: 0
      },
      status: 'new'
    }
  });

  const watchedStatus = watch('status');
  const watchedType = watch('trip.type');

  React.useEffect(() => {
    if (lead && isEditing) {
      reset({
        contact: lead.contact,
        trip: lead.trip,
        status: lead.status
      });
    }
  }, [lead, isEditing, reset]);

  const statusLabels = {
    new: 'Nuevo',
    quoted: 'Cotizado',
    negotiating: 'Negociando',
    won: 'Ganado',
    lost: 'Perdido'
  };

  const statusColors = {
    new: 'bg-blue-100 text-blue-800',
    quoted: 'bg-yellow-100 text-yellow-800', 
    negotiating: 'bg-orange-100 text-orange-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800'
  };

  const tripTypeLabels = {
    hotel: 'Hotel',
    flight: 'Vuelo',
    package: 'Paquete'
  };

  const onSubmit = (data: LeadFormData) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? 'Editar Lead' : 'Nuevo Lead'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Status - Only show when editing */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={watchedStatus} onValueChange={(value: LeadStatus) => setValue('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg">
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-xs ${statusColors[value as LeadStatus]}`}>
                          {label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Información de Contacto
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input 
                  id="name"
                  {...register('contact.name')}
                  className={errors.contact?.name ? 'border-red-500' : ''}
                />
                {errors.contact?.name && (
                  <p className="text-sm text-red-500">{errors.contact.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input 
                  id="phone"
                  {...register('contact.phone')}
                  className={errors.contact?.phone ? 'border-red-500' : ''}
                />
                {errors.contact?.phone && (
                  <p className="text-sm text-red-500">{errors.contact.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                {...register('contact.email')}
                className={errors.contact?.email ? 'border-red-500' : ''}
              />
              {errors.contact?.email && (
                <p className="text-sm text-red-500">{errors.contact.email.message}</p>
              )}
            </div>
          </div>

          {/* Trip Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Información del Viaje
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Viaje *</Label>
                <Select value={watchedType} onValueChange={(value: 'hotel' | 'flight' | 'package') => setValue('trip.type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg">
                    {Object.entries(tripTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ciudad *</Label>
                <Input 
                  id="city"
                  {...register('trip.city')}
                  className={errors.trip?.city ? 'border-red-500' : ''}
                />
                {errors.trip?.city && (
                  <p className="text-sm text-red-500">{errors.trip.city.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkin">Check-in *</Label>
                <Input 
                  id="checkin"
                  type="date"
                  {...register('trip.dates.checkin')}
                  className={errors.trip?.dates?.checkin ? 'border-red-500' : ''}
                />
                {errors.trip?.dates?.checkin && (
                  <p className="text-sm text-red-500">{errors.trip.dates.checkin.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout">Check-out *</Label>
                <Input 
                  id="checkout"
                  type="date"
                  {...register('trip.dates.checkout')}
                  className={errors.trip?.dates?.checkout ? 'border-red-500' : ''}
                />
                {errors.trip?.dates?.checkout && (
                  <p className="text-sm text-red-500">{errors.trip.dates.checkout.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adults">Adultos *</Label>
                <Input 
                  id="adults"
                  type="number"
                  min="1"
                  {...register('trip.adults', { valueAsNumber: true })}
                  className={errors.trip?.adults ? 'border-red-500' : ''}
                />
                {errors.trip?.adults && (
                  <p className="text-sm text-red-500">{errors.trip.adults.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="children">Niños</Label>
                <Input 
                  id="children"
                  type="number"
                  min="0"
                  {...register('trip.children', { valueAsNumber: true })}
                  className={errors.trip?.children ? 'border-red-500' : ''}
                />
                {errors.trip?.children && (
                  <p className="text-sm text-red-500">{errors.trip.children.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Show PDFs if editing */}
          {isEditing && lead && lead.pdf_urls && lead.pdf_urls.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDFs Asociados
              </h3>
              <div className="flex flex-wrap gap-2">
                {lead.pdf_urls.map((url, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    PDF {index + 1}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              {isEditing ? 'Guardar Cambios' : 'Crear Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}