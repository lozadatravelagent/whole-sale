import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, Seller, Section, ChecklistItem, Attachment } from '@/types';

export interface CreateLeadInput {
  contact: {
    name: string;
    phone: string;
    email?: string;
  };
  trip: {
    type: 'hotel' | 'flight' | 'package';
    dates: {
      checkin: string;
      checkout: string;
    };
    city: string;
    adults: number;
    children: number;
  };
  tenant_id: string;
  agency_id: string;
  status?: LeadStatus;
  section_id?: string;
  seller_id?: string;
  budget?: number;
  description?: string;
  due_date?: string;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
}

export interface UpdateLeadInput {
  id: string;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
  trip?: {
    type: 'hotel' | 'flight' | 'package';
    dates: {
      checkin: string;
      checkout: string;
    };
    city: string;
    adults: number;
    children: number;
  };
  status?: LeadStatus;
  section_id?: string;
  assigned_user_id?: string | null;
  seller_id?: string;
  budget?: number;
  description?: string;
  due_date?: string;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  pdf_urls?: string[];
}

// Fetch all leads, optionally filter by agency
export async function getLeads(agencyId?: string): Promise<Lead[]> {
  try {
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }

    // Convert database types to our Lead type with proper type casting
    return (data || []).map(lead => ({
      ...lead,
      contact: lead.contact as any,
      trip: lead.trip as any,
      checklist: lead.checklist ? (typeof lead.checklist === 'string' ? JSON.parse(lead.checklist) : lead.checklist) : [],
      attachments: lead.attachments ? (typeof lead.attachments === 'string' ? JSON.parse(lead.attachments) : lead.attachments) : [],
      budget: lead.budget ? Number(lead.budget) : undefined,
    })) as Lead[];
  } catch (error) {
    console.error('Error in getLeads:', error);
    return [];
  }
}

// Create a new lead
export async function createLead(input: CreateLeadInput): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        ...input,
        status: input.status || 'new',
        pdf_urls: [],
        checklist: input.checklist ? JSON.stringify(input.checklist) : JSON.stringify([]),
        attachments: input.attachments ? JSON.stringify(input.attachments) : JSON.stringify([]),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    return {
      ...data,
      contact: data.contact as any,
      trip: data.trip as any,
      checklist: data.checklist ? (typeof data.checklist === 'string' ? JSON.parse(data.checklist) : data.checklist) : [],
      attachments: data.attachments ? (typeof data.attachments === 'string' ? JSON.parse(data.attachments) : data.attachments) : [],
      budget: data.budget ? Number(data.budget) : undefined,
    } as Lead;
  } catch (error) {
    console.error('Error in createLead:', error);
    return null;
  }
}

// Update an existing lead
export async function updateLead(input: UpdateLeadInput): Promise<Lead | null> {
  try {
    const { id, checklist, attachments, ...otherData } = input;
    
    const updateData: any = { ...otherData };
    
    // Convert complex types to JSON for database storage
    if (checklist !== undefined) {
      updateData.checklist = JSON.stringify(checklist);
    }
    if (attachments !== undefined) {
      updateData.attachments = JSON.stringify(attachments);
    }
    
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      throw error;
    }

    return {
      ...data,
      contact: data.contact as any,
      trip: data.trip as any,
      checklist: data.checklist ? (typeof data.checklist === 'string' ? JSON.parse(data.checklist) : data.checklist) : [],
      attachments: data.attachments ? (typeof data.attachments === 'string' ? JSON.parse(data.attachments) : data.attachments) : [],
      budget: data.budget ? Number(data.budget) : undefined,
    } as Lead;
  } catch (error) {
    console.error('Error in updateLead:', error);
    return null;
  }
}

// Delete a lead
export async function deleteLead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteLead:', error);
    return false;
  }
}

// Update lead status (convenience function for drag & drop)
export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
  return updateLead({ id, status });
}

// Update lead section (for new dynamic sections)
export async function updateLeadSection(id: string, section_id: string): Promise<Lead | null> {
  return updateLead({ id, section_id });
}

// Fetch all sellers
export async function getSellers(): Promise<Seller[]> {
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching sellers:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSellers:', error);
    return [];
  }
}

// Fetch all sections for an agency
export async function getSections(agencyId: string): Promise<Section[]> {
  try {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('agency_id', agencyId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching sections:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSections:', error);
    return [];
  }
}

// Create a new section
export async function createSection(agencyId: string, name: string, color?: string): Promise<Section | null> {
  try {
    // Get the next position
    const { data: existingSections } = await supabase
      .from('sections')
      .select('position')
      .eq('agency_id', agencyId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existingSections && existingSections.length > 0 
      ? existingSections[0].position + 1 
      : 1;

    const { data, error } = await supabase
      .from('sections')
      .insert({
        agency_id: agencyId,
        name,
        color: color || 'bg-gray-100 text-gray-800 border-gray-200',
        position: nextPosition,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating section:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createSection:', error);
    return null;
  }
}

// Update checklist for a lead
export async function updateLeadChecklist(id: string, checklist: ChecklistItem[]): Promise<Lead | null> {
  return updateLead({ id, checklist });
}

// Add attachment to a lead
export async function addLeadAttachment(id: string, attachment: Attachment): Promise<Lead | null> {
  try {
    // Get current lead
    const { data: currentLead, error: fetchError } = await supabase
      .from('leads')
      .select('attachments')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching lead for attachment:', fetchError);
      throw fetchError;
    }

    const currentAttachments = (currentLead.attachments as any) || [];
    const newAttachments = [...currentAttachments, attachment];

    return updateLead({ id, attachments: newAttachments });
  } catch (error) {
    console.error('Error in addLeadAttachment:', error);
    return null;
  }
}