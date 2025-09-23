// Kanban-specific types for CRM feature
import type { Lead } from './lead';

export interface KanbanSection {
  id: string;
  name: string;
  color?: string;
  position: number;
  locked?: boolean;
  leadCount?: number;
  totalBudget?: number;
}

export interface KanbanCard {
  id: string;
  lead: Lead;
  position: number;
  sectionId: string;
}

export interface DragEndEvent {
  active: {
    id: string;
    data: {
      current: {
        type: 'lead';
        lead: Lead;
      };
    };
  };
  over: {
    id: string;
    data: {
      current: {
        type: 'section';
        section: KanbanSection;
      };
    };
  } | null;
}

export interface DragStartEvent {
  active: {
    id: string;
    data: {
      current: {
        type: 'lead';
        lead: Lead;
      };
    };
  };
}

export interface DragOverEvent {
  active: {
    id: string;
  };
  over: {
    id: string;
  } | null;
}

export interface KanbanBoardProps {
  sections: KanbanSection[];
  leadsBySection: Record<string, Lead[]>;
  budgetBySection: Record<string, number>;
  onLeadMove: (leadId: string, newSectionId: string) => void;
  onLeadClick: (lead: Lead) => void;
  onSectionCreate: () => void;
  onSectionDelete: (sectionId: string) => void;
  loading?: boolean;
}

export interface KanbanColumnProps {
  section: KanbanSection;
  leads: Lead[];
  budget: number;
  onLeadClick: (lead: Lead) => void;
  onAddLead: () => void;
  onDeleteSection: () => void;
  isOver?: boolean;
}

export interface KanbanCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  isDragging?: boolean;
  sectionName?: string;
}