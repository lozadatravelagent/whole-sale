import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Mail, 
  FileText, 
  User, 
  DollarSign, 
  CheckSquare, 
  Calendar, 
  Plus, 
  Trash2,
  Plane,
  Hotel,
  Package,
  Instagram,
  MessageSquare,
  Star,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Lead, LeadStatus, Section, Seller, ChecklistItem } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const watchedBudget = watch('budget');
  const watchedDueDate = watch('due_date');

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
      // Para nuevo lead, asignar la primera sección por defecto
      const defaultSectionId = sections.length > 0 ? sections[0].id : undefined;
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
    flight: 'Vuelos',
    package: 'Paquete'
  };

  const tripTypeIcons = {
    hotel: Hotel,
    flight: Plane,
    package: Package
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
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
              {/* Header with Title */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="h-6 w-6 text-muted-foreground" />
                  <Input
                    {...register('contact.name')}
                    placeholder="Nombre del cliente..."
                    className="text-2xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mb-4">
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Labels
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Checklist
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-1" />
                    Members
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Attachment
                  </Button>
                </div>

                {/* Due Date */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-muted-foreground">Due date</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="date"
                      {...register('due_date')}
                      className="w-auto text-sm"
                    />
                    {watchedDueDate && isOverdue(watchedDueDate) && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Description
                  </h3>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    {/* Destino */}
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 mt-0.5 text-blue-600" />
                      <div className="flex-1">
                        <strong>Destino:</strong>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            {...register('trip.city')}
                            placeholder="Ciudad destino..."
                            className="flex-1"
                          />
                          <Select value={watchedType} onValueChange={(value: 'hotel' | 'flight' | 'package') => setValue('trip.type', value)}>
                            <SelectTrigger className="w-32">
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
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-green-600" />
                      <div className="flex-1">
                        <strong>WhatsApp:</strong>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            {...register('contact.phone')}
                            placeholder="Número WhatsApp..."
                            className="flex-1"
                          />
                          <Button type="button" variant="link" size="sm" className="text-blue-600 p-0 h-auto">
                            Share on WhatsApp
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Instagram */}
                    <div className="flex items-start gap-3">
                      <Instagram className="h-4 w-4 mt-0.5 text-purple-600" />
                      <div className="flex-1">
                        <strong>Instagram:</strong>
                        <Input
                          {...register('contact.email')}
                          placeholder="@usuario o email..."
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="flex items-start gap-3">
                      <CalendarDays className="h-4 w-4 mt-0.5 text-orange-600" />
                      <div className="flex-1">
                        <strong>Fechas:</strong>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Input
                            type="date"
                            {...register('trip.dates.checkin')}
                            placeholder="Check-in"
                          />
                          <Input
                            type="date"
                            {...register('trip.dates.checkout')}
                            placeholder="Check-out"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Personas */}
                    <div className="flex items-start gap-3">
                      <Users className="h-4 w-4 mt-0.5 text-indigo-600" />
                      <div className="flex-1">
                        <strong>Personas:</strong>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Input
                            type="number"
                            min="1"
                            {...register('trip.adults', { valueAsNumber: true })}
                            placeholder="Adultos"
                          />
                          <Input
                            type="number"
                            min="0"
                            {...register('trip.children', { valueAsNumber: true })}
                            placeholder="Niños"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Presupuesto */}
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-4 w-4 mt-0.5 text-green-600" />
                      <div className="flex-1">
                        <strong>Presupuesto:</strong>
                        <Input
                          type="number"
                          min="0"
                          {...register('budget', { valueAsNumber: true })}
                          placeholder="Monto en USD"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Calificación del Lead */}
                    <div className="flex items-start gap-3">
                      <Star className="h-4 w-4 mt-0.5 text-yellow-600" />
                      <div className="flex-1">
                        <strong>Calificación del Lead:</strong>
                        <Select value={watchedStatus} onValueChange={(value: LeadStatus) => setValue('status', value)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Seleccionar calificación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">🔥 Alto potencial</SelectItem>
                            <SelectItem value="quoted">⚡ Medio potencial</SelectItem>
                            <SelectItem value="negotiating">💫 Bajo potencial</SelectItem>
                            <SelectItem value="won">✅ Ganado</SelectItem>
                            <SelectItem value="lost">❌ Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Servicio */}
                    <div className="flex items-start gap-3">
                      {React.createElement(tripTypeIcons[watchedType] || Plane, { 
                        className: "h-4 w-4 mt-0.5 text-blue-600" 
                      })}
                      <div className="flex-1">
                        <strong>Servicio:</strong>
                        <span className="ml-2">{tripTypeLabels[watchedType]}</span>
                      </div>
                    </div>

                    {/* Descripción adicional */}
                    <div className="pt-2">
                      <Textarea
                        {...register('description')}
                        placeholder="Notas adicionales..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Checklist Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckSquare className="h-5 w-5" />
                      Checklist
                    </h3>
                    <Badge variant="secondary">
                      {Math.round(progressPercentage)}%
                    </Badge>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-red-600">
                    Delete
                  </Button>
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
                    placeholder="Add an item"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                  />
                  <Button type="button" onClick={addChecklistItem} size="sm">
                    Add
                  </Button>
                </div>

                {/* Checklist Items */}
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded hover:bg-muted/70 transition-colors">
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

          {/* Right Sidebar */}
          <div className="w-80 border-l bg-muted/20 p-6 space-y-6">
            <h3 className="font-semibold text-lg">Add to card</h3>
            
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

            {/* Current Budget Display */}
            {watchedBudget && watchedBudget > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Presupuesto:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(watchedBudget)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Show PDFs if editing */}
            {isEditing && lead && Array.isArray(lead.pdf_urls) && lead.pdf_urls.length > 0 && (
              <div className="space-y-2">
                <Label>PDFs Asociados</Label>
                <div className="space-y-1">
                  {lead.pdf_urls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span className="text-sm">PDF {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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