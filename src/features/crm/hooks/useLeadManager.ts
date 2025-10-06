// Enhanced lead management hook with CRM-specific features
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Lead, LeadStatus, Section, Seller } from '@/types';
import type { LeadFormData, LeadFilters, LeadSortOptions } from '../types/lead';
import { LeadService } from '../services/leadService';
import { getLeads, getSellers, getSections } from '@/lib/supabase-leads';
import { useAuthUser } from '@/hooks/useAuthUser';

export function useLeadManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [sortOptions, setSortOptions] = useState<LeadSortOptions>({
    field: 'created_at',
    direction: 'desc'
  });

  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin } = useAuthUser();

  const DEFAULT_SECTION_NAMES = ['Nuevos', 'En progreso', 'Cotizado', 'Negociación', 'Ganado', 'Perdido'];
  const isUuid = (v: string) => /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v);

  // Fetch all leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(data);
      applyFiltersAndSort(data, filters, sortOptions);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los leads."
      });
    } finally {
      setLoading(false);
    }
  }, [filters, sortOptions, toast]);

  // Fetch sellers and sections
  const fetchSupportingData = useCallback(async () => {
    try {
      const [sellersData, sectionsData] = await Promise.all([
        getSellers(),
        getSections()
      ]);
      setSellers(sellersData);
      setSections(sectionsData);
    } catch (error) {
      console.error('Error fetching supporting data:', error);
    }
  }, []);

  // Apply filters and sorting
  const applyFiltersAndSort = useCallback((
    leadsData: Lead[],
    currentFilters: LeadFilters,
    currentSort: LeadSortOptions
  ) => {
    let filtered = [...leadsData];

    // Apply status filter
    if (currentFilters.status && currentFilters.status.length > 0) {
      filtered = filtered.filter(lead => currentFilters.status!.includes(lead.status));
    }

    // Apply date range filter
    if (currentFilters.dateRange) {
      filtered = filtered.filter(lead => {
        const leadDate = new Date(lead.created_at);
        const start = new Date(currentFilters.dateRange!.start);
        const end = new Date(currentFilters.dateRange!.end);
        return leadDate >= start && leadDate <= end;
      });
    }

    // Apply budget range filter
    if (currentFilters.budgetRange) {
      filtered = filtered.filter(lead => {
        const budget = lead.budget || 0;
        const { min, max } = currentFilters.budgetRange!;
        return (!min || budget >= min) && (!max || budget <= max);
      });
    }

    // Apply trip type filter
    if (currentFilters.tripType && currentFilters.tripType.length > 0) {
      filtered = filtered.filter(lead =>
        currentFilters.tripType!.includes(lead.trip.type)
      );
    }

    // Apply assigned user filter
    if (currentFilters.assignedUser && currentFilters.assignedUser.length > 0) {
      filtered = filtered.filter(lead =>
        lead.seller_id && currentFilters.assignedUser!.includes(lead.seller_id)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (currentSort.field) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'budget':
          aValue = a.budget || 0;
          bValue = b.budget || 0;
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'contact.name':
          aValue = a.contact.name.toLowerCase();
          bValue = b.contact.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (currentSort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredLeads(filtered);
  }, []);

  // Create new lead
  const createNewLead = useCallback(async (data: LeadFormData): Promise<boolean> => {
    setActionLoading(true);
    try {
      // If section_id is a default name (e.g., from 'all' board), resolve to real section_id for the target agency
      if (data.section_id && !isUuid(data.section_id) && DEFAULT_SECTION_NAMES.includes(data.section_id)) {
        if (!data.agency_id) {
          throw new Error('agency_id requerido para crear el lead con sección');
        }
        const agencySections = await getSections(data.agency_id);
        const target = agencySections.find(s => s.name === data.section_id);
        data.section_id = target ? target.id : undefined as any;
      }
      const newLead = await LeadService.createLead(data);
      if (newLead) {
        await fetchLeads();
        toast({
          title: "Éxito",
          description: "Lead creado correctamente."
        });
        return true;
      }
      return false;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el lead."
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [fetchLeads, toast]);

  // Update existing lead
  const updateExistingLead = useCallback(async (
    id: string,
    updates: Partial<LeadFormData>
  ): Promise<boolean> => {
    setActionLoading(true);
    try {
      // If updating section_id from 'all' board (name-based), map to real section id for the lead's agency
      if (updates.section_id && !isUuid(updates.section_id) && DEFAULT_SECTION_NAMES.includes(updates.section_id)) {
        const lead = leads.find(l => l.id === id);
        const agencyId = updates.agency_id || lead?.agency_id;
        if (agencyId) {
          const agencySections = await getSections(agencyId);
          const target = agencySections.find(s => s.name === updates.section_id);
          updates.section_id = target ? target.id : undefined;
        } else {
          // If no agency context, drop section update to avoid invalid uuid
          delete (updates as any).section_id;
        }
      }
      const updated = await LeadService.updateLead(id, updates);
      if (updated) {
        await fetchLeads();
        toast({
          title: "Éxito",
          description: "Lead actualizado correctamente."
        });
        return true;
      }
      return false;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el lead."
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [fetchLeads, toast]);

  // Delete lead
  const deleteLead = useCallback(async (id: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const deleted = await LeadService.deleteLead(id);
      if (deleted) {
        await fetchLeads();
        toast({
          title: "Éxito",
          description: "Lead eliminado correctamente."
        });
        return true;
      }
      return false;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el lead."
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [fetchLeads, toast]);

  // Move lead to section
  const moveLeadToSection = useCallback(async (
    leadId: string,
    newSectionId: string
  ): Promise<boolean> => {
    try {
      let targetSectionId = newSectionId;
      if (!isUuid(newSectionId) && DEFAULT_SECTION_NAMES.includes(newSectionId)) {
        const lead = leads.find(l => l.id === leadId);
        if (lead?.agency_id) {
          const agencySections = await getSections(lead.agency_id);
          const target = agencySections.find(s => s.name === newSectionId);
          if (target) targetSectionId = target.id;
        }
      }
      const moved = await LeadService.moveLeadToSection(leadId, targetSectionId);
      if (moved) {
        await fetchLeads();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error moving lead:', error);
      return false;
    }
  }, [fetchLeads]);

  // Update lead status
  const updateLeadStatus = useCallback(async (
    leadId: string,
    status: LeadStatus
  ): Promise<boolean> => {
    try {
      const updated = await LeadService.updateLeadStatus(leadId, status);
      if (updated) {
        await fetchLeads();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating lead status:', error);
      return false;
    }
  }, [fetchLeads]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<LeadFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    applyFiltersAndSort(leads, updatedFilters, sortOptions);
  }, [filters, leads, sortOptions, applyFiltersAndSort]);

  // Update sorting
  const updateSorting = useCallback((newSort: LeadSortOptions) => {
    setSortOptions(newSort);
    applyFiltersAndSort(leads, filters, newSort);
  }, [leads, filters, applyFiltersAndSort]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    applyFiltersAndSort(leads, {}, sortOptions);
  }, [leads, sortOptions, applyFiltersAndSort]);

  // Get leads by section for Kanban
  const getLeadsBySection = useCallback(() => {
    const leadsBySection: Record<string, Lead[]> = {};

    sections.forEach(section => {
      leadsBySection[section.id] = filteredLeads.filter(
        lead => lead.section_id === section.id
      );
    });

    return leadsBySection;
  }, [sections, filteredLeads]);

  // Get budget totals by section
  const getBudgetBySection = useCallback(() => {
    const budgetBySection: Record<string, number> = {};

    sections.forEach(section => {
      const sectionLeads = filteredLeads.filter(
        lead => lead.section_id === section.id
      );
      budgetBySection[section.id] = sectionLeads.reduce(
        (total, lead) => total + (lead.budget || 0),
        0
      );
    });

    return budgetBySection;
  }, [sections, filteredLeads]);

  // Initialize data
  useEffect(() => {
    fetchLeads();
    fetchSupportingData();
  }, [fetchLeads, fetchSupportingData]);

  return {
    // Data
    leads: filteredLeads,
    allLeads: leads,
    sellers,
    sections,
    filters,
    sortOptions,

    // Loading states
    loading,
    actionLoading,

    // Actions
    createNewLead,
    updateExistingLead,
    deleteLead,
    moveLeadToSection,
    updateLeadStatus,
    refreshLeads: fetchLeads,

    // Filtering and sorting
    updateFilters,
    updateSorting,
    clearFilters,

    // Computed data for Kanban
    getLeadsBySection,
    getBudgetBySection
  };
}