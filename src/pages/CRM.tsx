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
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Lock, Info, Filter, Building, Download } from 'lucide-react';
import { TrelloColumn } from '@/components/crm/TrelloColumn';
import { TrelloCard } from '@/components/crm/TrelloCard';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useAgencies } from '@/hooks/useAgencies';
import { CRMSkeleton } from '@/components/skeletons/CRMSkeleton';
import { Lead, Section } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterAgency, setFilterAgency] = useState<string>('all');

  const { agencies, loading: agenciesLoading } = useAgencies();

  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuth();

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
  } = useLeads((isOwner || isSuperAdmin) ? (filterAgency as any) : undefined);

  // Filtrar leads según rol y filtro seleccionado
  const getFilteredLeads = (sectionLeads: Lead[]) => {
    let filtered = sectionLeads;

    // SELLER: Solo ve sus leads asignados
    if (isSeller && user) {
      filtered = filtered.filter(lead => lead.assigned_user_id === user.id);
    }

    // OWNER/SUPERADMIN: Pueden filtrar por agencia
    if ((isOwner || isSuperAdmin) && filterAgency !== 'all') {
      filtered = filtered.filter(lead => lead.agency_id === filterAgency);
    }

    // ADMIN/SUPERADMIN/OWNER: Pueden filtrar por vendedor
    if ((isAdmin || isSuperAdmin || isOwner) && filterSeller !== 'all') {
      filtered = filtered.filter(lead => lead.assigned_user_id === filterSeller);
    }

    return filtered;
  };

  // Calcular total de leads visibles
  const totalVisibleLeads = sections.reduce((sum, section) => {
    const sectionLeads = leadsBySection[section.id] || [];
    return sum + getFilteredLeads(sectionLeads).length;
  }, 0);

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
    console.log('CRM handleSaveLead called with data:', data);
    console.log('CRM isEditing:', isEditing);
    console.log('CRM selectedLead:', selectedLead);

    try {
      // Use selected section for new lead or first section as fallback
      if (!data.section_id) {
        data.section_id = selectedSectionForNewLead || (sections.length > 0 ? sections[0].id : null);
      }

      if (isEditing && selectedLead) {
        console.log('CRM updating lead with ID:', selectedLead.id);
        const result = await editLead({
          id: selectedLead.id,
          ...data
        });
        console.log('CRM editLead result:', result);
        toast({
          title: "Tarjeta actualizada",
          description: "Los cambios se han guardado correctamente.",
        });
      } else {
        console.log('CRM creating new lead');
        const result = await addLead({
          ...data,
          tenant_id: user?.tenant_id || DUMMY_TENANT_ID,
          agency_id: (isOwner || isSuperAdmin) && filterAgency !== 'all' ? filterAgency : (user?.agency_id || DUMMY_AGENCY_ID)
        });
        console.log('CRM addLead result:', result);
        toast({
          title: "Nueva tarjeta creada",
          description: "La tarjeta se ha agregado correctamente.",
        });
      }
      console.log('CRM closing dialog');
      setIsDialogOpen(false);
      setSelectedSectionForNewLead(null);
    } catch (error) {
      console.error('Error in handleSaveLead:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la tarjeta. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleNewSection = async () => {
    const targetAgencyId = (isOwner || isSuperAdmin) && filterAgency !== 'all' ? filterAgency : (user?.agency_id || DUMMY_AGENCY_ID);
    await addSection(targetAgencyId, `Nueva Lista ${sections.length + 1}`);
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

  const handleExportCSV = () => {
    // Get all visible leads based on filters
    const allVisibleLeads = sections.flatMap(section => {
      const sectionLeads = leadsBySection[section.id] || [];
      return getFilteredLeads(sectionLeads);
    });

    if (allVisibleLeads.length === 0) {
      toast({
        title: "No hay datos para exportar",
        description: "No hay leads visibles con los filtros actuales.",
        variant: "destructive",
      });
      return;
    }

    // CSV Headers
    const headers = [
      'Cliente',
      'Email',
      'Teléfono',
      'Tipo de Viaje',
      'Destino',
      'Fecha Check-in',
      'Fecha Check-out',
      'Adultos',
      'Niños',
      'Presupuesto',
      'Estado',
      'Sección',
      'Vendedor',
      'Agencia',
      'Fecha de Creación',
      'Descripción'
    ];

    // Convert leads to CSV rows
    const rows = allVisibleLeads.map(lead => {
      const section = sections.find(s => s.id === lead.section_id);
      const seller = sellers.find(s => s.id === lead.assigned_user_id);
      const agency = agencies.find(a => a.id === lead.agency_id);

      return [
        lead.contact?.name || '',
        lead.contact?.email || '',
        lead.contact?.phone || '',
        lead.trip?.type || '',
        lead.trip?.city || '',
        lead.trip?.dates?.checkin || '',
        lead.trip?.dates?.checkout || '',
        lead.trip?.adults || '0',
        lead.trip?.children || '0',
        lead.budget || '0',
        lead.status || '',
        section?.name || '',
        seller?.name || seller?.email || '',
        agency?.name || '',
        new Date(lead.created_at).toLocaleDateString('es-ES'),
        (lead.description || '').replace(/"/g, '""') // Escape quotes
      ];
    });

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `crm-leads-${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportación exitosa",
      description: `Se exportaron ${allVisibleLeads.length} leads a ${filename}`,
    });
  };

  if (loading) {
    return <CRMSkeleton />;
  }

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-full bg-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10 bg-white/5"></div>

        {/* Banner contextual para SELLER */}
        {isSeller && (
          <div className="relative z-10 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>Viendo solo tus leads asignados ({totalVisibleLeads})</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 bg-card border-b border-border">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Selector de agencia para OWNER y SUPERADMIN, o nombre fijo para otros roles */}
            {(isOwner || isSuperAdmin) && agencies.length > 0 ? (
              <Select value={filterAgency} onValueChange={setFilterAgency}>
                <SelectTrigger className="w-[200px] md:w-[250px] h-9 border-none shadow-none font-semibold text-base md:text-lg">
                  <SelectValue placeholder="Todas las agencias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las agencias</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
                {user?.agency_id ? agencies.find(a => a.id === user.agency_id)?.name || 'Mi Agencia' : 'CRM'}
              </h1>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
            >
              <Star className="h-3.5 md:h-4 w-3.5 md:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted hidden sm:flex"
            >
              <Lock className="h-3.5 md:h-4 w-3.5 md:w-4" />
              <span className="ml-1 text-xs md:text-sm">Privado</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro por vendedor (solo para ADMIN, SUPERADMIN, OWNER) */}
            {(isAdmin || isSuperAdmin || isOwner) && sellers.length > 0 && (
              <Select value={filterSeller} onValueChange={setFilterSeller}>
                <SelectTrigger className="w-[180px] h-9 text-xs md:text-sm">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name || seller.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="gap-2 text-xs md:text-sm"
            >
              <Download className="h-3.5 md:h-4 w-3.5 md:w-4" />
              Exportar CSV
            </Button>

            <Button
              onClick={handleNewSection}
              variant="ghost"
              className="text-muted-foreground hover:bg-muted gap-2 text-xs md:text-sm"
            >
              <Plus className="h-3.5 md:h-4 w-3.5 md:w-4" />
              Agregar otra lista
            </Button>
          </div>
        </div>

        {/* Board Content */}
        <div className="relative z-10 p-2 md:p-4 h-[calc(100vh-80px)] md:h-[calc(100vh-80px)] overflow-y-hidden">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-2 md:gap-3 h-full min-w-0 overflow-x-auto pb-4">
              <SortableContext
                items={sections.map(s => s.id)}
                strategy={horizontalListSortingStrategy}
              >
                {sections.map((section) => {
                  const sectionLeads = leadsBySection[section.id] || [];
                  const filteredLeads = getFilteredLeads(sectionLeads);

                  return (
                    <TrelloColumn
                      key={section.id}
                      section={section}
                      leads={filteredLeads}
                      onEdit={handleEditLead}
                      onAddCard={() => handleNewLead(section.id)}
                      onDeleteSection={handleDeleteSection}
                      isOver={overId === section.id}
                    />
                  );
                })}
              </SortableContext>

              {/* Add new list button */}
              {sections.length > 0 && (
                <div className="w-72 md:w-80 flex-shrink-0">
                  <Button
                    onClick={handleNewSection}
                    variant="ghost"
                    className="w-full justify-start bg-muted hover:bg-muted/80 text-muted-foreground border-border h-auto py-2 md:py-3 text-xs md:text-sm"
                  >
                    <Plus className="h-3.5 md:h-4 w-3.5 md:w-4 mr-2" />
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
            <div className="flex items-center justify-center h-full px-4">
              <div className="text-center text-foreground max-w-md">
                <h3 className="text-lg md:text-xl font-semibold mb-2">¡Bienvenido a tu nuevo tablero!</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">Crea tu primera lista para empezar a organizar</p>
                <Button
                  onClick={handleNewSection}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm"
                >
                  <Plus className="h-3.5 md:h-4 w-3.5 md:w-4 mr-2" />
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
          onDelete={async (leadId) => {
            await removeLead(leadId);
            setIsDialogOpen(false);
            toast({
              title: "Tarjeta eliminada",
              description: "La tarjeta se ha eliminado correctamente.",
            });
          }}
          onTransferComplete={() => {
            // Reload leads after transfer
            window.location.reload();
          }}
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