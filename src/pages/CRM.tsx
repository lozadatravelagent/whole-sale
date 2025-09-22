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
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, Star, Lock } from 'lucide-react';
import { TrelloColumn } from '@/components/crm/TrelloColumn';
import { TrelloCard } from '@/components/crm/TrelloCard';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { useLeads } from '@/hooks/useLeads';
import { Lead, Section } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Dummy data for initial testing
const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DUMMY_AGENCY_ID = '00000000-0000-0000-0000-000000000002';

export default function CRM() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedSectionForNewLead, setSelectedSectionForNewLead] = useState<string | null>(null);

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
    removeSection,
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

    const lead = leads.find(l => l.id === activeId);
    if (!lead) return;

    const targetSection = sections.find(s => s.id === overId);
    if (targetSection && lead.section_id !== targetSection.id) {
      moveLeadToSection(activeId, targetSection.id);
      toast({
        title: "Tarjeta movida",
        description: `Movida a ${targetSection.name}`,
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleNewLead = (sectionId?: string) => {
    setSelectedLead(null);
    setSelectedSectionForNewLead(sectionId || null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleSaveLead = async (data: any) => {
    try {
      // Use selected section for new lead or first section as fallback
      if (!data.section_id) {
        data.section_id = selectedSectionForNewLead || (sections.length > 0 ? sections[0].id : null);
      }

      if (isEditing && selectedLead) {
        await editLead({
          id: selectedLead.id,
          ...data
        });
        toast({
          title: "Tarjeta actualizada",
          description: "Los cambios se han guardado correctamente.",
        });
      } else {
        await addLead({
          ...data,
          tenant_id: DUMMY_TENANT_ID,
          agency_id: DUMMY_AGENCY_ID
        });
        toast({
          title: "Nueva tarjeta creada",
          description: "La tarjeta se ha agregado correctamente.",
        });
      }
      setIsDialogOpen(false);
      setSelectedSectionForNewLead(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la tarjeta. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleNewSection = async () => {
    await addSection(DUMMY_AGENCY_ID, `Nueva Lista ${sections.length + 1}`);
  };

  const handleDeleteSection = (section: Section) => {
    setSectionToDelete(section);
  };

  const confirmDeleteSection = async () => {
    if (sectionToDelete) {
      await removeSection(sectionToDelete.id);
      setSectionToDelete(null);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-full bg-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10 bg-white/5"></div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-4 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              Lozada Madero
            </h1>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Lock className="h-4 w-4" />
              Privado
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleNewSection}
              variant="ghost"
              className="text-muted-foreground hover:bg-muted gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar otra lista
            </Button>
          </div>
        </div>

        {/* Board Content */}
        <div className="relative z-10 p-4 h-[calc(100vh-80px)] overflow-y-hidden">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 h-full min-w-0">
              <SortableContext
                items={sections.map(s => s.id)}
                strategy={horizontalListSortingStrategy}
              >
                {sections.map((section) => (
                  <TrelloColumn
                    key={section.id}
                    section={section}
                    leads={leadsBySection[section.id] || []}
                    onEdit={handleEditLead}
                    onAddCard={() => handleNewLead(section.id)}
                    onDeleteSection={handleDeleteSection}
                    isOver={overId === section.id}
                  />
                ))}
              </SortableContext>

              {/* Add new list button */}
              {sections.length > 0 && (
                <div className="w-80 flex-shrink-0">
                  <Button
                    onClick={handleNewSection}
                    variant="ghost"
                    className="w-full justify-start bg-muted hover:bg-muted/80 text-muted-foreground border-border h-auto py-3"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar otra lista
                  </Button>
                </div>
              )}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeLead ? (
                <div className="transform rotate-2 opacity-90 scale-105">
                  <TrelloCard
                    lead={activeLead}
                    onClick={() => { }}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Empty state */}
          {sections.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-foreground">
                <h3 className="text-xl font-semibold mb-2">¡Bienvenido a tu nuevo tablero!</h3>
                <p className="text-muted-foreground mb-6">Crea tu primera lista para empezar a organizar</p>
                <Button
                  onClick={handleNewSection}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera lista
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Lead Dialog */}
        <LeadDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          lead={selectedLead}
          onSave={handleSaveLead}
          isEditing={isEditing}
          sections={sections}
          sellers={sellers}
        />

        {/* Delete Section Confirmation */}
        <AlertDialog open={!!sectionToDelete} onOpenChange={() => setSectionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar lista?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente la lista "{sectionToDelete?.name}".
                {leadsBySection[sectionToDelete?.id || '']?.length > 0 && (
                  <span className="block mt-2 font-medium text-amber-600">
                    Las {leadsBySection[sectionToDelete?.id || '']?.length} tarjetas en esta lista serán movidas a la primera lista disponible.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteSection}
                className="bg-destructive hover:bg-destructive/90"
              >
                Eliminar lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}