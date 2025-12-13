// Lead CRUD operations and business logic
import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadStatus } from '@/types';
import type { LeadFormData, LeadFilters, LeadSortOptions } from '../types/lead';

export class LeadService {
  // Create a new lead
  static async createLead(data: LeadFormData): Promise<Lead | null> {
    try {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert([{
          contact: data.contact,
          trip: data.trip,
          status: data.status || 'new',
          section_id: data.section_id,
          assigned_user_id: data.assigned_user_id,
          budget: data.budget || 0,
          description: data.description || '',
          due_date: data.due_date || null,
          checklist: data.checklist || []
        }])
        .select()
        .single();

      if (error) throw error;
      return newLead;
    } catch (error) {
      console.error('Error creating lead:', error);
      return null;
    }
  }

  // Update an existing lead
  static async updateLead(id: string, updates: Partial<LeadFormData>): Promise<Lead | null> {
    try {
      const { data: updatedLead, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedLead;
    } catch (error) {
      console.error('Error updating lead:', error);
      return null;
    }
  }

  // Delete a lead
  static async deleteLead(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      return false;
    }
  }

  // Move lead to different section
  static async moveLeadToSection(leadId: string, newSectionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ section_id: newSectionId })
        .eq('id', leadId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error moving lead:', error);
      return false;
    }
  }

  // Update lead status
  static async updateLeadStatus(leadId: string, status: LeadStatus): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating lead status:', error);
      return false;
    }
  }

  // Get leads with filters and sorting
  static async getFilteredLeads(
    filters?: LeadFilters,
    sortOptions?: LeadSortOptions
  ): Promise<Lead[]> {
    try {
      let query = supabase.from('leads').select('*');

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.start)
          .lte('created_at', filters.dateRange.end);
      }

      if (filters?.budgetRange) {
        if (filters.budgetRange.min) {
          query = query.gte('budget', filters.budgetRange.min);
        }
        if (filters.budgetRange.max) {
          query = query.lte('budget', filters.budgetRange.max);
        }
      }

      if (filters?.tripType && filters.tripType.length > 0) {
        query = query.in('trip->type', filters.tripType);
      }

      if (filters?.assignedUser && filters.assignedUser.length > 0) {
        query = query.in('assigned_user_id', filters.assignedUser);
      }

      // Apply sorting
      if (sortOptions) {
        query = query.order(sortOptions.field, { ascending: sortOptions.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting filtered leads:', error);
      return [];
    }
  }

  // Get leads by section
  static async getLeadsBySection(sectionId: string): Promise<Lead[]> {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting leads by section:', error);
      return [];
    }
  }

  // Get lead statistics
  static async getLeadStats(): Promise<{
    total: number;
    byStatus: Record<LeadStatus, number>;
    totalBudget: number;
    averageBudget: number;
  }> {
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('status, budget');

      if (error) throw error;

      const total = leads?.length || 0;
      const byStatus = leads?.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<LeadStatus, number>) || {} as Record<LeadStatus, number>;

      const totalBudget = leads?.reduce((sum, lead) => sum + (lead.budget || 0), 0) || 0;
      const averageBudget = total > 0 ? totalBudget / total : 0;

      return {
        total,
        byStatus,
        totalBudget,
        averageBudget
      };
    } catch (error) {
      console.error('Error getting lead stats:', error);
      return {
        total: 0,
        byStatus: {} as Record<LeadStatus, number>,
        totalBudget: 0,
        averageBudget: 0
      };
    }
  }
}