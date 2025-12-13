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
  assigned_user_id?: string; // User ID from users table with role='SELLER'
  /** @deprecated Use assigned_user_id instead */
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
    // Convert empty strings to null for UUID fields and dates. Keep JSON fields as objects/arrays (no manual stringify)
    const processedInput = {
      ...input,
      due_date: input.due_date && input.due_date.trim() !== '' ? input.due_date : null,
      section_id: input.section_id && input.section_id.trim() !== '' ? input.section_id : null,
      // Support both assigned_user_id and seller_id (deprecated) for backward compatibility
      assigned_user_id: input.assigned_user_id && input.assigned_user_id.trim() !== ''
        ? input.assigned_user_id
        : (input.seller_id && input.seller_id.trim() !== '' ? input.seller_id : null),
      seller_id: undefined, // Remove seller_id from insert
      // Handle empty date strings in trip dates
      trip: {
        ...input.trip,
        dates: {
          checkin: input.trip.dates.checkin && input.trip.dates.checkin.trim() !== '' ? input.trip.dates.checkin : null,
          checkout: input.trip.dates.checkout && input.trip.dates.checkout.trim() !== '' ? input.trip.dates.checkout : null,
        }
      },
      // Ensure JSONB fields are proper JSON values
      checklist: Array.isArray(input.checklist) ? input.checklist : [],
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
      // Always send an array for pdf_urls
      pdf_urls: Array.isArray((input as any).pdf_urls) ? (input as any).pdf_urls : []
    };

    const insertData = {
      tenant_id: processedInput.tenant_id,
      agency_id: processedInput.agency_id,
      contact: processedInput.contact,
      trip: processedInput.trip,
      status: (processedInput.status || 'new') as LeadStatus,
      budget: processedInput.budget ?? 0,
      description: processedInput.description ?? '',
      conversation_id: (input as any).conversation_id || null,
      section_id: processedInput.section_id || null,
      assigned_user_id: processedInput.assigned_user_id || null,  // Include assigned_user_id
      // Leave checklist, attachments, pdf_urls, due_date to defaults
    } as any;

    const { data, error } = await supabase
      .from('leads')
      .insert(insertData)
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

    // Normalize UUID fields: convert empty strings to null
    const normalizeUuid = (v: any) => (typeof v === 'string' && v.trim() === '' ? null : v);
    if ('section_id' in updateData) updateData.section_id = normalizeUuid(updateData.section_id);
    if ('assigned_user_id' in updateData) updateData.assigned_user_id = normalizeUuid(updateData.assigned_user_id);
    if ('seller_id' in updateData) {
      // Remove deprecated field if present
      delete updateData.seller_id;
    }
    if ('due_date' in updateData) {
      updateData.due_date = updateData.due_date && (updateData.due_date as string).trim() !== ''
        ? updateData.due_date
        : null;
    }
    if ('trip' in updateData && updateData.trip?.dates) {
      updateData.trip = {
        ...updateData.trip,
        dates: {
          checkin: updateData.trip.dates.checkin && (updateData.trip.dates.checkin as string).trim() !== '' ? updateData.trip.dates.checkin : null,
          checkout: updateData.trip.dates.checkout && (updateData.trip.dates.checkout as string).trim() !== '' ? updateData.trip.dates.checkout : null,
        }
      };
    }

    // Include checklist and attachments in updateData (they're already in the correct format for JSONB)
    if (checklist !== undefined) {
      updateData.checklist = checklist;
    }
    if (attachments !== undefined) {
      updateData.attachments = attachments;
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

// Fetch all sellers (now from users table with role='SELLER')
export async function getSellers(agencyId?: string): Promise<Seller[]> {
  try {
    let query = supabase
      .from('users')
      .select('id, email, created_at')
      .eq('role', 'SELLER')
      .order('email', { ascending: true });

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sellers:', error);
      throw error;
    }

    // Map User to Seller interface for backward compatibility
    return (data || []).map(user => ({
      id: user.id,
      name: user.email.split('@')[0], // Use email username as name
      email: user.email,
      created_at: user.created_at,
      updated_at: user.created_at, // users table doesn't have updated_at
    }));
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

// Delete a section
export async function deleteSection(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting section:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteSection:', error);
    return false;
  }
}