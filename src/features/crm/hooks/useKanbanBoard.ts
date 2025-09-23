// Hook for managing Kanban board drag and drop functionality
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Lead } from '@/types';
import type { DragEndEvent, DragStartEvent, DragOverEvent, KanbanSection } from '../types/kanban';

export function useKanbanBoard() {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [overSectionId, setOverSectionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { toast } = useToast();

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const lead = event.active.data.current?.lead;
    if (lead) {
      setDraggedLead(lead);
      setIsDragging(true);
    }
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const sectionId = event.over?.id;
    if (typeof sectionId === 'string') {
      setOverSectionId(sectionId);
    } else {
      setOverSectionId(null);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((
    event: DragEndEvent,
    onLeadMove: (leadId: string, newSectionId: string) => void
  ) => {
    setIsDragging(false);
    setDraggedLead(null);
    setOverSectionId(null);

    const { active, over } = event;

    if (!over) return;

    const leadId = active.id as string;
    const newSectionId = over.id as string;
    const lead = active.data.current?.lead;

    if (!lead) return;

    // Check if lead is moving to a different section
    if (lead.section_id !== newSectionId) {
      try {
        onLeadMove(leadId, newSectionId);
        toast({
          title: "Lead movido",
          description: `${lead.contact.name} fue movido exitosamente.`
        });
      } catch (error) {
        console.error('Error moving lead:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo mover el lead."
        });
      }
    }
  }, [toast]);

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setDraggedLead(null);
    setOverSectionId(null);
  }, []);

  // Check if section is drop target
  const isDropTarget = useCallback((sectionId: string): boolean => {
    return overSectionId === sectionId && isDragging;
  }, [overSectionId, isDragging]);

  // Check if lead is being dragged
  const isLeadDragging = useCallback((leadId: string): boolean => {
    return draggedLead?.id === leadId;
  }, [draggedLead]);

  // Get section statistics
  const getSectionStats = useCallback((
    leads: Lead[],
    sections: KanbanSection[]
  ) => {
    return sections.map(section => {
      const sectionLeads = leads.filter(lead => lead.section_id === section.id);
      const totalBudget = sectionLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);

      return {
        ...section,
        leadCount: sectionLeads.length,
        totalBudget
      };
    });
  }, []);

  // Calculate conversion rates between sections
  const getConversionRates = useCallback((
    leads: Lead[],
    sections: KanbanSection[]
  ) => {
    const conversionRates: Record<string, Record<string, number>> = {};

    sections.forEach(fromSection => {
      conversionRates[fromSection.id] = {};

      sections.forEach(toSection => {
        if (fromSection.id !== toSection.id) {
          // This is a simplified calculation
          // In a real implementation, you'd track historical moves
          const fromLeads = leads.filter(lead => lead.section_id === fromSection.id);
          const toLeads = leads.filter(lead => lead.section_id === toSection.id);

          if (fromLeads.length > 0) {
            conversionRates[fromSection.id][toSection.id] =
              (toLeads.length / (fromLeads.length + toLeads.length)) * 100;
          } else {
            conversionRates[fromSection.id][toSection.id] = 0;
          }
        }
      });
    });

    return conversionRates;
  }, []);

  // Get section performance metrics
  const getSectionPerformance = useCallback((
    leads: Lead[],
    section: KanbanSection
  ) => {
    const sectionLeads = leads.filter(lead => lead.section_id === section.id);

    const totalBudget = sectionLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
    const averageBudget = sectionLeads.length > 0 ? totalBudget / sectionLeads.length : 0;

    // Calculate average time in section (simplified - would need historical data)
    const averageTimeInSection = 0; // Placeholder

    // Get status distribution
    const statusDistribution = sectionLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      leadCount: sectionLeads.length,
      totalBudget,
      averageBudget,
      averageTimeInSection,
      statusDistribution
    };
  }, []);

  // Validate drag operation
  const canDropInSection = useCallback((
    lead: Lead,
    targetSectionId: string,
    sections: KanbanSection[]
  ): boolean => {
    const targetSection = sections.find(s => s.id === targetSectionId);

    if (!targetSection) return false;

    // Check if section is locked
    if (targetSection.locked) return false;

    // Add any other business rules here
    // For example, certain lead statuses might not be allowed in certain sections

    return true;
  }, []);

  // Auto-organize leads within section
  const getOptimalLeadOrder = useCallback((leads: Lead[]): Lead[] => {
    // Sort leads by priority (highest budget first, then by due date)
    return [...leads].sort((a, b) => {
      // First by budget (descending)
      const budgetDiff = (b.budget || 0) - (a.budget || 0);
      if (budgetDiff !== 0) return budgetDiff;

      // Then by due date (closest first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }

      // Finally by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, []);

  return {
    // Drag state
    draggedLead,
    overSectionId,
    isDragging,

    // Drag handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,

    // Utilities
    isDropTarget,
    isLeadDragging,
    canDropInSection,

    // Analytics
    getSectionStats,
    getConversionRates,
    getSectionPerformance,
    getOptimalLeadOrder
  };
}