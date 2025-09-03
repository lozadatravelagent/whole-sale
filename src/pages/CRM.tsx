import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, DollarSign } from 'lucide-react';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { useLeads } from '@/hooks/useLeads';
import { Lead, Section } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Dummy data for initial testing - usar tenant y agency reales después
const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DUMMY_AGENCY_ID = '00000000-0000-0000-0000-000000000002';

// Draggable Lead Card Component
function DraggableLeadCard({ 
  lead, 
  onEdit, 
  onDelete, 
  onSave,
  seller 
}: { 
  lead: Lead; 
  onEdit: () => void; 
  onDelete: () => void;
  onSave: (updates: Partial<Lead>) => void;
  seller?: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: lead.id,
    data: {
      type: 'lead',
      lead
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <LeadCard 
        lead={lead}
        onClick={onEdit}
        onDelete={onDelete}
        onSave={onSave}
        isDragging={isDragging}
        seller={seller}
      />
    </div>
  );
}

// Droppable Section Column Component
function DroppableSection({ 
  section,
  leads, 
  onEdit, 
  onDelete,
  onSave,
  totalBudget,
  sellers,
  isOver
}: { 
  section: Section;
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onSave: (lead: Lead, updates: Partial<Lead>) => void;
  totalBudget: number;
  sellers: any[];
  isOver?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: section.id,
    data: {
      type: 'section',
      section
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card 
      ref={setNodeRef}
      className={`flex-1 min-h-[600px] transition-colors ${
        isOver ? 'bg-primary/5 border-primary/30' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-4 w-4" />
            {section.name}
            <Badge variant="secondary" className={section.color}>
              {leads.length}
            </Badge>
          </CardTitle>
        </div>
        {totalBudget > 0 && (
          <div className="flex items-center gap-1 text-sm text-green-600 font-semibold">
            <DollarSign className="h-4 w-4" />
            {formatCurrency(totalBudget)}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <SortableContext 
          items={leads.map(lead => lead.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 min-h-[400px]">
            {leads.map((lead) => {
              const seller = sellers.find(s => s.id === lead.seller_id);
              return (
                <DraggableLeadCard
                  key={lead.id}
                  lead={lead}
                  onEdit={() => onEdit(lead)}
                  onDelete={() => onDelete(lead)}
                  onSave={(updates) => onSave(lead, updates)}
                  seller={seller}
                />
              );
            })}
            {leads.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">📋</div>
                <p>No hay leads en {section.name.toLowerCase()}</p>
                <p className="text-xs mt-1">Arrastra leads aquí</p>
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export default function CRM() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const { 
    sections, 
    sellers, 
    leadsBySection, 
    budgetBySection, 
    loading, 
    addLead, 
    editLead, 
    removeLead, 
    moveLeadToSection, 
    addSection,
    leads
  } = useLeads();
  
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const leadData = active.data.current;
    
    if (leadData?.type === 'lead') {
      setActiveLead(leadData.lead);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveLead(null);
    setOverId(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Get the lead being dragged
    const lead = leads.find(l => l.id === activeId);
    if (!lead) return;

    // Check if dropping on a different section
    const targetSection = sections.find(s => s.id === overId);
    if (targetSection && lead.section_id !== targetSection.id) {
      // Move lead to new section
      moveLeadToSection(activeId, targetSection.id);
      toast({
        title: "Lead movido",
        description: `Lead movido a ${targetSection.name}`,
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleQuickSave = async (lead: Lead, updates: Partial<Lead>) => {
    try {
      await editLead({
        id: lead.id,
        ...updates
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el lead",
        variant: "destructive",
      });
    }
  };

  const handleNewLead = () => {
    setSelectedLead(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleDeleteLead = (lead: Lead) => {
    setLeadToDelete(lead);
  };

  const confirmDelete = () => {
    if (leadToDelete) {
      removeLead(leadToDelete.id);
      setLeadToDelete(null);
    }
  };

  const handleSaveLead = async (data: any) => {
    try {
      // Add default section if no section specified
      if (!data.section_id && sections.length > 0) {
        data.section_id = sections[0].id;
      }

      if (isEditing && selectedLead) {
        await editLead({
          id: selectedLead.id,
          ...data
        });
        toast({
          title: "Lead actualizado",
          description: "Los cambios se han guardado correctamente.",
        });
      } else {
        await addLead({
          ...data,
          tenant_id: DUMMY_TENANT_ID,
          agency_id: DUMMY_AGENCY_ID
        });
        toast({
          title: "Lead creado",
          description: "El nuevo lead se ha creado correctamente.",
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el lead. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleNewSection = async () => {
    const colors = [
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-teal-100 text-teal-800 border-teal-200',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    await addSection(DUMMY_AGENCY_ID, `Nueva Sección ${sections.length + 1}`, randomColor);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-4"></div>
            <div className="grid grid-cols-5 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-96 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              CRM - Gestión de Leads
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el embudo de ventas arrastrando los leads entre secciones
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={handleNewSection} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Sección
            </Button>
            <Button onClick={handleNewLead} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Nuevo Lead
            </Button>
          </div>
        </div>

        {/* Kanban Board with Drag & Drop */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={`grid gap-6 min-h-[600px]`} style={{ gridTemplateColumns: `repeat(${sections.length || 1}, 1fr)` }}>
            {sections.map((section) => (
              <DroppableSection
                key={section.id}
                section={section}
                leads={leadsBySection[section.id] || []}
                onEdit={handleEditLead}
                onDelete={handleDeleteLead}
                onSave={handleQuickSave}
                totalBudget={budgetBySection[section.id] || 0}
                sellers={sellers}
                isOver={overId === section.id}
              />
            ))}
          </div>

          {/* Drag Overlay - Preview while dragging */}
          <DragOverlay>
            {activeLead ? (
              <div className="transform rotate-2 opacity-90 scale-105 shadow-2xl">
                <LeadCard 
                  lead={activeLead} 
                  isDragging 
                  seller={sellers.find(s => s.id === activeLead.seller_id)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {sections.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏗️</div>
            <h3 className="text-lg font-semibold mb-2">No hay secciones configuradas</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera sección para empezar a organizar leads</p>
            <Button onClick={handleNewSection} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Primera Sección
            </Button>
          </div>
        )}

        {/* Enhanced Lead Dialog */}
        <LeadDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          lead={selectedLead}
          onSave={handleSaveLead}
          isEditing={isEditing}
          sections={sections}
          sellers={sellers}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Lead?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El lead "{leadToDelete?.contact.name}" 
                será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}