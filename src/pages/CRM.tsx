import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, TrendingUp, Calendar, Filter } from 'lucide-react';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { useLeads } from '@/hooks/useLeads';
import { Lead, LeadStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const statusConfig = {
  new: { 
    title: 'Nuevos', 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: Users,
    description: 'Leads recién llegados'
  },
  quoted: { 
    title: 'Cotizados', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: Calendar,
    description: 'Con cotización enviada' 
  },
  negotiating: { 
    title: 'Negociando', 
    color: 'bg-orange-100 text-orange-800 border-orange-200', 
    icon: TrendingUp,
    description: 'En proceso de cierre'
  },
  won: { 
    title: 'Ganados', 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: TrendingUp,
    description: 'Ventas confirmadas'
  },
  lost: { 
    title: 'Perdidos', 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: Users,
    description: 'Oportunidades perdidas'
  }
};

// Dummy data for initial testing - usar tenant y agency reales después
const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DUMMY_AGENCY_ID = '00000000-0000-0000-0000-000000000002';

function SortableLeadCard({ lead, onEdit, onDelete }: { 
  lead: Lead; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id });

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
        isDragging={isDragging}
      />
    </div>
  );
}

function KanbanColumn({ 
  status, 
  leads, 
  onEdit, 
  onDelete 
}: { 
  status: LeadStatus; 
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card className="flex-1 min-h-[600px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-4 w-4" />
            {config.title}
            <Badge variant="secondary" className={config.color}>
              {leads.length}
            </Badge>
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </CardHeader>

      <CardContent>
        <SortableContext 
          items={leads.map(lead => lead.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {leads.map((lead) => (
              <SortableLeadCard
                key={lead.id}
                lead={lead}
                onEdit={() => onEdit(lead)}
                onDelete={() => onDelete(lead)}
              />
            ))}
            {leads.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">📋</div>
                <p>No hay leads en {config.title.toLowerCase()}</p>
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
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const { leadsByStatus, sections, sellers, budgetBySection, loading, addLead, editLead, removeLead, moveLeadToStatus, moveLeadToSection, addSection } = useLeads();
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
    const lead = findLeadById(active.id as string);
    setDraggedLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDraggedLead(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dropping on a section
    const targetSection = sections.find(section => section.id === overId);
    if (targetSection) {
      // Moving lead to different section
      const lead = findLeadById(activeId);
      if (lead && lead.section_id !== targetSection.id) {
        moveLeadToSection(activeId, targetSection.id);
      }
    } else {
      // Fallback to status-based movement for backward compatibility
      const targetStatus = overId as LeadStatus;
      if (statusConfig[targetStatus]) {
        const lead = findLeadById(activeId);
        if (lead && lead.status !== targetStatus) {
          moveLeadToStatus(activeId, targetStatus);
        }
      }
    }

    setDraggedLead(null);
  };

  const findLeadById = (id: string): Lead | null => {
    for (const statusLeads of Object.values(leadsByStatus)) {
      const lead = statusLeads.find(l => l.id === id);
      if (lead) return lead;
    }
    return null;
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditing(true);
    setIsDialogOpen(true);
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
    if (isEditing && selectedLead) {
      await editLead({
        id: selectedLead.id,
        ...data
      });
    } else {
      await addLead({
        ...data,
        tenant_id: DUMMY_TENANT_ID,
        agency_id: DUMMY_AGENCY_ID
      });
    }
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
            <h1 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              CRM - Gestión de Leads
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el embudo de ventas arrastrando los leads entre estados
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={() => addSection('00000000-0000-0000-0000-000000000002', `Nueva Sección ${sections.length + 1}`)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Sección
            </Button>
            <Button onClick={handleNewLead} className="gap-2 bg-gradient-hero shadow-primary">
              <Plus className="h-4 w-4" />
              Nuevo Lead
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-6 min-h-[600px]">
            {(Object.keys(statusConfig) as LeadStatus[]).map((status) => (
              <div
                key={status}
                id={status}
                className="droppable"
                style={{ minHeight: '600px' }}
              >
                <KanbanColumn
                  status={status}
                  leads={leadsByStatus[status]}
                  onEdit={handleEditLead}
                  onDelete={handleDeleteLead}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {draggedLead ? (
              <div className="transform rotate-2">
                <LeadCard lead={draggedLead} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Lead Dialog */}
        <LeadDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          lead={selectedLead}
          onSave={handleSaveLead}
          isEditing={isEditing}
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