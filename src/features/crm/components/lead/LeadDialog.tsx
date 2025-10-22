// Refactored Lead Dialog with enhanced form validation and UX
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MapPin,
  Users,
  DollarSign,
  MessageSquare,
  Trash2,
  Plus,
  Calendar,
  Plane,
  Hotel,
  Package,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { LeadDialogProps } from '../../types/lead';
import { useFormValidation } from '../../hooks/useFormValidation';

export function LeadDialog({
  open,
  onOpenChange,
  lead,
  onSave,
  onDelete,
  isEditing = false,
  sections = [],
  sellers = []
}: LeadDialogProps) {
  const {
    form,
    handleSubmitWithValidation,
    resetForm,
    checklist,
    newChecklistItem,
    setNewChecklistItem,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    getChecklistProgress,
    customValidationErrors,
    customValidationWarnings,
    getAllErrors,
    isValid,
    isSubmitting,
    isDirty
  } = useFormValidation(lead ? {
    contact: lead.contact,
    trip: lead.trip,
    status: lead.status,
    section_id: lead.section_id,
    seller_id: lead.seller_id,
    budget: lead.budget,
    description: lead.description || '',
    due_date: lead.due_date || '',
    checklist: lead.checklist
  } : undefined);

  const { register, setValue, watch, formState: { errors } } = form;

  const watchedType = watch('trip.type');
  const watchedSectionId = watch('section_id');
  const watchedSellerId = watch('seller_id');

  // Handle form submission
  const onSubmit = handleSubmitWithValidation((data) => {
    // Ensure section_id is set for new leads
    if (!data.section_id && sections.length > 0) {
      data.section_id = sections[0].id;
    }
    onSave(data);
    onOpenChange(false);
  });

  // Handle dialog close
  const handleClose = () => {
    if (isDirty) {
      const confirmClose = window.confirm('¿Estás seguro de que quieres cerrar? Los cambios no guardados se perderán.');
      if (!confirmClose) return;
    }
    resetForm();
    onOpenChange(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (!lead || !onDelete) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar el lead de "${lead.contact.name}"?\n\nEsta acción no se puede deshacer.`
    );

    if (confirmDelete) {
      onDelete(lead.id);
      onOpenChange(false);
    }
  };

  // Calculate progress
  const progressPercentage = getChecklistProgress();
  const allErrors = getAllErrors();

  // Debug
  console.log('LeadDialog Props:', {
    isEditing,
    hasOnDelete: !!onDelete,
    hasLead: !!lead,
    leadId: lead?.id
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0">
        <form onSubmit={onSubmit} className="flex h-[95vh]">
          {/* Main Content - Left Side */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Header with Editable Title */}
              <div className="mb-6">
                <Input
                  {...register('contact.name')}
                  placeholder="Nombre del cliente..."
                  className="text-2xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 mb-4"
                  style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
                />
                {errors.contact?.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.contact.name.message}</p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
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

              {/* Validation Alerts */}
              {allErrors.length > 0 && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {allErrors.map((error, index) => (
                        <li key={index} className="text-red-600 text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {customValidationWarnings.length > 0 && (
                <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {customValidationWarnings.map((warning, index) => (
                        <li key={index} className="text-yellow-600 text-sm">{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Description Section */}
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold">Descripción</h3>
                <Textarea
                  {...register('description')}
                  placeholder="Agrega una descripción más detallada..."
                  rows={12}
                  className="resize-none min-h-[200px]"
                />
              </div>

              {/* Checklist Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Lista de tareas</h3>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {progressPercentage === 100 ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground" />
                      )}
                      {progressPercentage}%
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${progressPercentage === 100 ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Add new item */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar elemento"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                  />
                  <Button type="button" onClick={addChecklistItem} size="sm" disabled={!newChecklistItem.trim()}>
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
          <div className="w-80 border-l bg-muted/20 p-6 overflow-y-auto">
            <h3 className="font-semibold text-lg mb-6 text-red-600">🔴 VERSIÓN ACTUALIZADA - Información del viaje</h3>
            <div className="space-y-6">

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
                {errors.budget && (
                  <p className="text-sm text-red-600">{errors.budget.message}</p>
                )}
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
                {errors.trip?.city && (
                  <p className="text-sm text-red-600">{errors.trip.city.message}</p>
                )}
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

              {/* Fechas */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fechas
                </Label>
                <div className="space-y-2">
                  <Input
                    type="date"
                    {...register('trip.dates.checkin')}
                    placeholder="Fecha de entrada"
                  />
                  {errors.trip?.dates?.checkin && (
                    <p className="text-sm text-red-600">{errors.trip.dates.checkin.message}</p>
                  )}
                  <Input
                    type="date"
                    {...register('trip.dates.checkout')}
                    placeholder="Fecha de salida"
                  />
                  {errors.trip?.dates?.checkout && (
                    <p className="text-sm text-red-600">{errors.trip.dates.checkout.message}</p>
                  )}
                </div>
              </div>

              {/* Personas */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Adultos
                </Label>
                <Input
                  type="number"
                  min="1"
                  {...register('trip.adults', { valueAsNumber: true })}
                  placeholder="Número de adultos"
                />
                {errors.trip?.adults && (
                  <p className="text-sm text-red-600">{errors.trip.adults.message}</p>
                )}
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
                {errors.trip?.children && (
                  <p className="text-sm text-red-600">{errors.trip.children.message}</p>
                )}
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
                {errors.contact?.phone && (
                  <p className="text-sm text-red-600">{errors.contact.phone.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email (opcional)</Label>
                <Input
                  type="email"
                  {...register('contact.email')}
                  placeholder="Correo electrónico"
                />
                {errors.contact?.email && (
                  <p className="text-sm text-red-600">{errors.contact.email.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-6 space-y-2">
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Transferir Owner
                  </Button>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Guardando...
                    </div>
                  ) : (
                    isEditing ? 'Guardar Cambios' : 'Crear Lead'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={isSubmitting || !onDelete || !lead || !isEditing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Tarjeta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}