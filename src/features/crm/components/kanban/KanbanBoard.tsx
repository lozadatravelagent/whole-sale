// Main Kanban Board component with drag and drop functionality
import React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart3, Settings } from 'lucide-react';
import type { KanbanBoardProps } from '../../types/kanban';
import { useKanbanBoard } from '../../hooks/useKanbanBoard';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export function KanbanBoard({
  sections,
  leadsBySection,
  budgetBySection,
  onLeadMove,
  onLeadClick,
  onSectionCreate,
  onSectionDelete,
  loading = false
}: KanbanBoardProps) {
  const {
    draggedLead,
    isDragging,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    isDropTarget,
    getSectionStats
  } = useKanbanBoard();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sectionStats = getSectionStats(
    Object.values(leadsBySection).flat(),
    sections
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pipeline de Leads</h2>
          <p className="text-muted-foreground">
            Gestiona tus leads arrastrando y soltando entre secciones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurar
          </Button>
          <Button onClick={onSectionCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Sección
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {Object.values(leadsBySection).flat().length}
            </div>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              ${Object.values(budgetBySection).reduce((sum, budget) => sum + budget, 0).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Presupuesto Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {sections.length}
            </div>
            <p className="text-sm text-muted-foreground">Secciones Activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(
                Object.values(budgetBySection).reduce((sum, budget) => sum + budget, 0) /
                Math.max(Object.values(leadsBySection).flat().length, 1)
              ).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Promedio por Lead</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => handleDragEnd(event, onLeadMove)}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
          <SortableContext
            items={sections.map(section => section.id)}
            strategy={horizontalListSortingStrategy}
          >
            {sections.map((section) => {
              const sectionLeads = leadsBySection[section.id] || [];
              const budget = budgetBySection[section.id] || 0;
              const sectionStat = sectionStats.find(s => s.id === section.id);

              return (
                <KanbanColumn
                  key={section.id}
                  section={sectionStat || section}
                  leads={sectionLeads}
                  budget={budget}
                  onLeadClick={onLeadClick}
                  onAddLead={onSectionCreate}
                  onDeleteSection={() => onSectionDelete(section.id)}
                  isOver={isDropTarget(section.id)}
                />
              );
            })}
          </SortableContext>

          {/* Add Section Button */}
          <div className="w-80 flex-shrink-0">
            <Card className="h-32 border-dashed border-2 border-muted-foreground/25 bg-muted/10">
              <CardContent className="h-full flex items-center justify-center">
                <Button
                  variant="ghost"
                  onClick={onSectionCreate}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Sección
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedLead && (
            <div className="rotate-3 opacity-90">
              <KanbanCard
                lead={draggedLead}
                onClick={() => {}}
                isDragging={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {sections.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No hay secciones configuradas</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primera sección para comenzar a organizar tus leads
            </p>
            <Button onClick={onSectionCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Crear Primera Sección
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}