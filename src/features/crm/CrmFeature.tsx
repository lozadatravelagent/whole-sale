// Main CRM Feature component that orchestrates all CRM functionality
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Plane,
  Settings,
  Plus,
  Filter,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Import CRM components
import { KanbanBoard } from './components/kanban';
import { LeadDialog } from './components/lead';
import { TravelSelector } from './components/travel';
import { LoadingSpinner, EmptyState } from './components/shared';

// Import CRM hooks
import { useLeadManager } from './hooks/useLeadManager';
import { useTravelSelection } from './hooks/useTravelSelection';

// Import types
import type { Lead } from '@/types';
import type { LeadFormData } from './types/lead';
import type { CombinedTravelResults } from '@/types';

interface CrmFeatureProps {
  // Optional travel data for travel selector
  travelData?: CombinedTravelResults;
  // Initial active tab
  initialTab?: 'kanban' | 'travel' | 'analytics';
}

export function CrmFeature({
  travelData,
  initialTab = 'kanban'
}: CrmFeatureProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);

  const { toast } = useToast();

  // Lead management
  const {
    leads,
    sellers,
    sections,
    loading,
    actionLoading,
    createNewLead,
    updateExistingLead,
    deleteLead,
    moveLeadToSection,
    refreshLeads,
    getLeadsBySection,
    getBudgetBySection
  } = useLeadManager();

  // Travel selection (for travel tab)
  const {
    selectedFlights,
    selectedHotels,
    generatePdf,
    getSelectionSummary
  } = useTravelSelection();

  // Handle lead actions
  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditingLead(true);
    setShowLeadDialog(true);
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setIsEditingLead(false);
    setShowLeadDialog(true);
  };

  const handleSaveLead = async (data: LeadFormData) => {
    try {
      let success = false;

      if (isEditingLead && selectedLead) {
        success = await updateExistingLead(selectedLead.id, data);
      } else {
        success = await createNewLead(data);
      }

      if (success) {
        setShowLeadDialog(false);
        setSelectedLead(null);
        await refreshLeads();
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el lead."
      });
    }
  };

  const handleLeadMove = async (leadId: string, newSectionId: string) => {
    await moveLeadToSection(leadId, newSectionId);
  };

  const handleSectionCreate = () => {
    // This would typically open a section creation dialog
    // For now, we'll trigger the add lead dialog
    handleAddLead();
  };

  const handleSectionDelete = async (sectionId: string) => {
    // Implementation for section deletion
    console.log('Delete section:', sectionId);
  };

  // Handle travel PDF generation
  const handleTravelPdfGenerated = async (
    pdfUrl: string,
    flights: any[],
    hotels: any[]
  ) => {
    toast({
      title: "PDF Generado",
      description: "La cotización de viaje ha sido generada exitosamente."
    });

    // Here you could save the PDF to a lead or create a new lead
    console.log('PDF generated:', pdfUrl, flights, hotels);
  };

  // Get summary statistics
  const totalLeads = leads.length;
  const totalBudget = Object.values(getBudgetBySection()).reduce((sum, budget) => sum + budget, 0);
  const activeSections = sections.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground">
            Gestiona tus leads, cotizaciones y pipeline de ventas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={handleAddLead} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              Distribuidos en {activeSections} secciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalBudget.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: ${totalLeads > 0 ? Math.round(totalBudget / totalLeads).toLocaleString() : 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones Activas</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedFlights.length + selectedHotels.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedFlights.length} vuelos, {selectedHotels.length} hoteles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Pipeline
            {totalLeads > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalLeads}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="travel" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Cotizaciones
            {(selectedFlights.length + selectedHotels.length) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedFlights.length + selectedHotels.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Kanban Board Tab */}
        <TabsContent value="kanban">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : sections.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No hay secciones configuradas"
              description="Crea tu primera sección para comenzar a organizar tus leads"
              action={{
                label: "Crear Primera Sección",
                onClick: handleSectionCreate,
                icon: <Plus className="h-4 w-4" />
              }}
            />
          ) : (
            <KanbanBoard
              sections={sections}
              leadsBySection={getLeadsBySection()}
              budgetBySection={getBudgetBySection()}
              onLeadMove={handleLeadMove}
              onLeadClick={handleLeadClick}
              onSectionCreate={handleSectionCreate}
              onSectionDelete={handleSectionDelete}
              loading={actionLoading}
            />
          )}
        </TabsContent>

        {/* Travel Selector Tab */}
        <TabsContent value="travel">
          {travelData ? (
            <TravelSelector
              combinedData={travelData}
              onPdfGenerated={handleTravelPdfGenerated}
            />
          ) : (
            <EmptyState
              icon="✈️"
              title="No hay datos de viaje disponibles"
              description="Los datos de vuelos y hoteles aparecerán aquí cuando estén disponibles"
            />
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Dashboard de analytics en desarrollo...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Dialog */}
      <LeadDialog
        open={showLeadDialog}
        onOpenChange={setShowLeadDialog}
        lead={selectedLead}
        onSave={handleSaveLead}
        isEditing={isEditingLead}
        sections={sections}
        sellers={sellers}
      />
    </div>
  );
}