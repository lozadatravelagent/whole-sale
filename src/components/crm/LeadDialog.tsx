import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, MapPin, Users, Phone, Mail, FileText, User, DollarSign, CheckSquare, Calendar, Plus, Trash2 } from 'lucide-react';
import { Lead, LeadStatus, Section, Seller, ChecklistItem } from '@/types';
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
  status: z.enum(['new', 'quoted', 'negotiating', 'won', 'lost']).optional(),
  section_id: z.string().optional(),
  seller_id: z.string().optional(),
  budget: z.number().min(0).optional(),
  description: z.string().optional(),
  due_date: z.string().optional()
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSave: (data: LeadFormData & { checklist?: ChecklistItem[] }) => void;
  isEditing?: boolean;
  sections?: Section[];
  sellers?: Seller[];
}

export function LeadDialog({ 
  open, 
  onOpenChange, 
  lead, 
  onSave, 
  isEditing = false, 
  sections = [], 
  sellers = [] 
}: LeadDialogProps) {
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = React.useState('');

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
      status: lead.status,
      section_id: lead.section_id,
      seller_id: lead.seller_id,
      budget: lead.budget,
      description: lead.description || '',
      due_date: lead.due_date || ''
    } : {
      contact: { name: '', phone: '', email: '' },
      trip: { 
        type: 'hotel',
        city: '',
        dates: { checkin: '', checkout: '' },
        adults: 1,
        children: 0
      },
      status: 'new',
      budget: 0,
      description: '',
      due_date: ''
    }
  });

  const watchedStatus = watch('status');
  const watchedType = watch('trip.type');
  const watchedSectionId = watch('section_id');
  const watchedSellerId = watch('seller_id');

  React.useEffect(() => {
    if (lead && isEditing) {
      reset({
        contact: lead.contact,
        trip: lead.trip,
        status: lead.status,
        section_id: lead.section_id,
        seller_id: lead.seller_id,
        budget: lead.budget,
        description: lead.description || '',
        due_date: lead.due_date || ''
      });
      setChecklist(Array.isArray(lead.checklist) ? lead.checklist : []);
    } else {
      setChecklist([]);
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

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newChecklistItem.trim(),
        completed: false
      };
      setChecklist([...checklist, newItem]);
      setNewChecklistItem('');
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const onSubmit = (data: LeadFormData) => {
    onSave({ ...data, checklist });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? 'Editar Lead' : 'Nuevo Lead'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Información de Contacto
                </h3>
                
                <div className="space-y-3">
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

                  <div className="grid grid-cols-2 gap-3">
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
                </div>
              </div>

              {/* Trip Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Información del Viaje
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo de Viaje *</Label>
                    <Select value={watchedType} onValueChange={(value: 'hotel' | 'flight' | 'package') => setValue('trip.type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="checkin">Check-in *</Label>
                    <Input 
                      id="checkin"
                      type="date"
                      {...register('trip.dates.checkin')}
                      className={errors.trip?.dates?.checkin ? 'border-red-500' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkout">Check-out *</Label>
                    <Input 
                      id="checkout"
                      type="date"
                      {...register('trip.dates.checkout')}
                      className={errors.trip?.dates?.checkout ? 'border-red-500' : ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="adults">Adultos *</Label>
                    <Input 
                      id="adults"
                      type="number"
                      min="1"
                      {...register('trip.adults', { valueAsNumber: true })}
                      className={errors.trip?.adults ? 'border-red-500' : ''}
                    />
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
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Lead Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Detalles del Lead
                </h3>

                {/* Section Selection */}
                {sections.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sección</Label>
                    <Select value={watchedSectionId} onValueChange={(value: string) => setValue('section_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sección" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Seller Selection */}
                {sellers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Vendedor Asignado</Label>
                    <Select value={watchedSellerId} onValueChange={(value: string) => setValue('seller_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {sellers.map((seller) => (
                          <SelectItem key={seller.id} value={seller.id}>
                            {seller.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Budget */}
                  <div className="space-y-2">
                    <Label htmlFor="budget" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Presupuesto
                    </Label>
                    <Input 
                      id="budget"
                      type="number"
                      min="0"
                      step="1"
                      {...register('budget', { valueAsNumber: true })}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label htmlFor="due_date" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Fecha Límite
                    </Label>
                    <Input 
                      id="due_date"
                      type="date"
                      {...register('due_date')}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea 
                    id="description"
                    placeholder="Notas adicionales, detalles del viaje, etc."
                    rows={3}
                    {...register('description')}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Lista de Tareas
                </h3>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Agregar nueva tarea..."
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                    />
                    <Button type="button" onClick={addChecklistItem} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                        />
                        <span className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {item.text}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Show PDFs if editing */}
              {isEditing && lead && Array.isArray(lead.pdf_urls) && lead.pdf_urls.length > 0 && (
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
            </div>
          </div>

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