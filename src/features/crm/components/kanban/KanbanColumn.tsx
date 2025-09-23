// Kanban Column component for organizing leads by section
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import type { KanbanColumnProps } from '../../types/kanban';
import { KanbanCard } from './KanbanCard';
import { formatCurrency } from '../../utils';

export function KanbanColumn({
  section,
  leads,
  budget,
  onLeadClick,
  onAddLead,
  onDeleteSection,
  isOver = false
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: section.id,
    data: {
      type: 'section',
      section
    }
  });

  const averageBudget = leads.length > 0 ? budget / leads.length : 0;

  return (
    <div className="w-80 flex-shrink-0">
      <Card
        ref={setNodeRef}
        className={`h-full flex flex-col transition-all duration-200 ${
          isOver
            ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20'
            : 'bg-background hover:shadow-md'
        }`}
      >
        {/* Header */}
        <CardHeader className="flex-shrink-0 p-0">
          <div className="p-4 pb-2">
            {/* Section Title and Count */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <CardTitle
                  className="text-sm font-semibold text-foreground truncate"
                  style={{ color: section.color }}
                >
                  {section.name}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {leads.length}
                </Badge>
                {section.locked && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                    Bloqueada
                  </Badge>
                )}
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onAddLead}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Lead
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurar Sección
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDeleteSection}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Sección
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Section Stats */}
            <div className="space-y-2">
              {/* Budget Stats */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>Total:</span>
                </div>
                <span className="font-medium text-green-600">
                  {formatCurrency(budget)}
                </span>
              </div>

              {/* Average Budget */}
              {leads.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Promedio:</span>
                  </div>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(averageBudget)}
                  </span>
                </div>
              )}

              {/* Lead Distribution */}
              {leads.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Densidad:</span>
                  </div>
                  <div className="flex gap-1">
                    {leads.slice(0, 5).map((_, index) => (
                      <div
                        key={index}
                        className="w-1 h-2 bg-primary/60 rounded-full"
                      />
                    ))}
                    {leads.length > 5 && (
                      <span className="text-xs text-muted-foreground">+{leads.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-hidden p-4 pt-0">
          <SortableContext
            items={leads.map(lead => lead.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 h-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {leads.map((lead) => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  onClick={onLeadClick}
                  sectionName={section.name}
                />
              ))}

              {/* Empty State */}
              {leads.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-3xl mb-3">📋</div>
                  <p className="text-sm mb-2">No hay leads</p>
                  <p className="text-xs mb-4 text-muted-foreground/70">
                    Arrastra leads aquí o
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddLead}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Crear Lead
                  </Button>
                </div>
              )}

              {/* Drop Zone Indicator */}
              {isOver && leads.length > 0 && (
                <div className="border-2 border-dashed border-primary/50 bg-primary/10 rounded-lg p-4 text-center">
                  <div className="text-sm text-primary font-medium">
                    Soltar aquí
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </CardContent>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddLead}
            className="w-full text-xs justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Agregar lead
          </Button>
        </div>
      </Card>
    </div>
  );
}