import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus } from '@/types';

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
  assigned_user_id?: string | null;
  pdf_urls?: string[];
}

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

    return (data || []) as Lead[];
  } catch (error) {
    console.error('Error in getLeads:', error);
    return [];
  }
}

export async function createLead(input: CreateLeadInput): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert([{
        ...input,
        status: input.status || 'new',
        pdf_urls: []
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    return data as Lead;
  } catch (error) {
    console.error('Error in createLead:', error);
    return null;
  }
}

export async function updateLead(input: UpdateLeadInput): Promise<Lead | null> {
  try {
    const { id, ...updateData } = input;
    
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

    return data as Lead;
  } catch (error) {
    console.error('Error in updateLead:', error);
    return null;
  }
}

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

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
  return updateLead({ id, status });
}