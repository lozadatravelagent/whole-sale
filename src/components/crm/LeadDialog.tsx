import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CalendarDays, 
  MapPin, 
  Users, 
  Phone, 
  DollarSign, 
  User, 
  Plane,
  Hotel,
  Package,
  MessageSquare,
  Trash2,
  Plus,
  Calendar
} from 'lucide-react';
import { Lead, LeadStatus, Section, Seller, ChecklistItem } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

  const watchedType = watch('trip.type');
  const watchedSectionId = watch('section_id');
  const watchedSellerId = watch('seller_id');
  const watchedDueDate = watch('due_date');

  React.useEffect(() => {
    if (lead && isEditing) {
      reset({
        contact: lead.contact,
        trip: lead.trip,
        status: lead.status,
        section_id: lead.section_id || '',
        seller_id: lead.seller_id || '',
        budget: lead.budget,
        description: lead.description || '',
        due_date: lead.due_date || ''
      });
      setChecklist(Array.isArray(lead.checklist) ? lead.checklist : []);
    } else {
      // Para nuevo lead, asignar la primera sección por defecto
      const defaultSectionId = sections.length > 0 ? sections[0].id : '';
      reset({
        contact: { name: '', phone: '', email: '' },
        trip: { 
          type: 'hotel',
          city: '',
          dates: { checkin: '', checkout: '' },
          adults: 1,
          children: 0
        },
        status: 'new',
        section_id: defaultSectionId,
        seller_id: '',
        budget: 0,
        description: '',
        due_date: ''
      });
      setChecklist([
        { id: '1', text: 'Usuario Contactado', completed: false },
        { id: '2', text: 'Presupuesto Enviado', completed: false },
        { id: '3', text: 'Presupuesto Pagado', completed: false },
        { id: '4', text: 'Pasaporte Subido', completed: false }
      ]);
    }
  }, [lead, isEditing, reset, sections]);

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
    // Ensure section_id is set for new leads
    if (!data.section_id && sections.length > 0) {
      data.section_id = sections[0].id;
    }
    onSave({ ...data, checklist });
  };

  const completedTasks = checklist.filter(item => item.completed).length;
  const progressPercentage = checklist.length > 0 ? (completedTasks / checklist.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full">
          {/* Main Content - Left Side */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Header with Editable Title */}
              <div className="mb-6">
                <Input
                  {...register('contact.name')}
                  placeholder="Título de la tarjeta..."
                  className="text-2xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 mb-4"
                  style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
                />

                {/* Action Buttons - Updated according to user specs */}
                <div className="flex items-center gap-2 mb-4">
                  {/* Sección Dropdown */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Sección:</Label>
                    <Select value={watchedSectionId} onValueChange={(value: string) => setValue('section_id', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Sección" />
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

                  {/* Vendedor */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Vendedor:</Label>
                    <Select value={watchedSellerId} onValueChange={(value: string) => setValue('seller_id', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Vendedor" />
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

                  {/* Due Date */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Fecha límite:</Label>
                    <Input
                      type="date"
                      {...register('due_date')}
                      className="w-auto text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Description Section - Free text field like Trello */}
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold">Descripción</h3>
                <Textarea
                  {...register('description')}
                  placeholder="Agrega una descripción más detallada..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Checklist Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Lista de tareas</h3>
                    <Badge variant="secondary">
                      {Math.round(progressPercentage)}%
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Add new item */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar elemento"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                  />
                  <Button type="button" onClick={addChecklistItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Checklist Items */}
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded hover:bg-muted/70 transition-colors group">
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleChecklistItem(item.id)}
                      />
                      <span className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChecklistItem(item.id)}
                        className="text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Business Fields */}
          <div className="w-80 border-l bg-muted/20 p-6 space-y-6">
            <h3 className="font-semibold text-lg">Información del viaje</h3>
            
            {/* Presupuesto */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Presupuesto
              </Label>
              <Input
                type="number"
                min="0"
                {...register('budget', { valueAsNumber: true })}
                placeholder="Monto en USD"
              />
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Destino
              </Label>
              <Input
                {...register('trip.city')}
                placeholder="Ciudad destino"
              />
            </div>

            {/* Servicio */}
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select value={watchedType} onValueChange={(value: 'hotel' | 'flight' | 'package') => setValue('trip.type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      Vuelo
                    </div>
                  </SelectItem>
                  <SelectItem value="hotel">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4" />
                      Hotel
                    </div>
                  </SelectItem>
                  <SelectItem value="package">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Paquete
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fechas - Ida y Vuelta */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fechas
              </Label>
              <div className="space-y-2">
                <Input
                  type="date"
                  {...register('trip.dates.checkin')}
                  placeholder="Fecha de ida"
                />
                <Input
                  type="date"
                  {...register('trip.dates.checkout')}
                  placeholder="Fecha de vuelta"
                />
              </div>
            </div>

            {/* Personas */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Personas
              </Label>
              <Input
                type="number"
                min="1"
                {...register('trip.adults', { valueAsNumber: true })}
                placeholder="Número de adultos"
              />
            </div>

            {/* Niños */}
            <div className="space-y-2">
              <Label>Niños</Label>
              <Input
                type="number"
                min="0"
                {...register('trip.children', { valueAsNumber: true })}
                placeholder="Número de niños"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Label>
              <Input
                type="tel"
                {...register('contact.phone')}
                placeholder="Número de WhatsApp"
              />
            </div>

            {/* Actions */}
            <div className="pt-6 space-y-2">
              <Button type="submit" className="w-full">
                {isEditing ? 'Guardar Cambios' : 'Crear Lead'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}