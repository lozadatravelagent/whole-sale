// Lead-specific types for CRM feature
import type { Lead, LeadStatus, ChecklistItem, Attachment } from '@/types';

export type { Lead, LeadStatus, ChecklistItem, Attachment };

// Extended lead types for CRM functionality
export interface LeadContact {
  name: string;
  phone: string;
  email?: string;
}

export interface TripDetails {
  type: 'hotel' | 'flight' | 'package';
  dates: {
    checkin: string;
    checkout: string;
  };
  city: string;
  adults: number;
  children: number;
}

export interface LeadFormData {
  contact: LeadContact;
  trip: TripDetails;
  status?: LeadStatus;
  section_id?: string;
  seller_id?: string;
  agency_id?: string;
  budget?: number;
  description?: string;
  due_date?: string;
  checklist?: ChecklistItem[];
}

export interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onDelete?: () => void;
  onSave?: (updates: Partial<Lead>) => void;
  isDragging?: boolean;
  sectionName?: string;
}

export interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSave: (data: LeadFormData & { checklist?: ChecklistItem[] }) => void;
  onDelete?: (leadId: string) => void;
  isEditing?: boolean;
  sections?: any[];
  sellers?: any[];
}

// Lead filters and sorting
export interface LeadFilters {
  status?: LeadStatus[];
  dateRange?: {
    start: string;
    end: string;
  };
  budgetRange?: {
    min: number;
    max: number;
  };
  tripType?: ('hotel' | 'flight' | 'package')[];
  assignedUser?: string[];
}

export interface LeadSortOptions {
  field: 'created_at' | 'budget' | 'due_date' | 'contact.name';
  direction: 'asc' | 'desc';
}