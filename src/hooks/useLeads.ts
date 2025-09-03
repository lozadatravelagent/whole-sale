import { useState, useEffect } from 'react';
import { Lead, LeadStatus, Seller, Section } from '@/types';
import { 
  getLeads, 
  createLead, 
  updateLead, 
  deleteLead, 
  updateLeadStatus, 
  updateLeadSection,
  getSellers,
  getSections,
  createSection,
  deleteSection,
  CreateLeadInput, 
  UpdateLeadInput 
} from '@/lib/supabase-leads';
import { useToast } from '@/hooks/use-toast';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch leads from Supabase
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los leads."
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch sellers
  const fetchSellers = async () => {
    try {
      const data = await getSellers();
      setSellers(data);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  // Fetch sections
  const fetchSections = async (agencyId: string) => {
    try {
      const data = await getSections(agencyId);
      setSections(data);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  // Create new lead
  const addLead = async (input: CreateLeadInput) => {
    try {
      const newLead = await createLead(input);
      if (newLead) {
        setLeads(prev => [newLead, ...prev]);
        toast({
          title: "Éxito",
          description: "Lead creado correctamente."
        });
        return newLead;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "No se pudo crear el lead."
      });
    }
    return null;
  };

  // Update existing lead
  const editLead = async (input: UpdateLeadInput) => {
    try {
      const updatedLead = await updateLead(input);
      if (updatedLead) {
        setLeads(prev => prev.map(lead => 
          lead.id === input.id ? updatedLead : lead
        ));
        toast({
          title: "Éxito",
          description: "Lead actualizado correctamente."
        });
        return updatedLead;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el lead."
      });
    }
    return null;
  };

  // Delete lead
  const removeLead = async (id: string) => {
    try {
      const success = await deleteLead(id);
      if (success) {
        setLeads(prev => prev.filter(lead => lead.id !== id));
        toast({
          title: "Éxito",
          description: "Lead eliminado correctamente."
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el lead."
      });
    }
  };

  // Update lead status (for backward compatibility)
  const moveLeadToStatus = async (id: string, newStatus: LeadStatus) => {
    try {
      const updatedLead = await updateLeadStatus(id, newStatus);
      if (updatedLead) {
        setLeads(prev => prev.map(lead => 
          lead.id === id ? updatedLead : lead
        ));
        return updatedLead;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo mover el lead."
      });
    }
    return null;
  };

  // Move lead to section (new drag & drop functionality)
  const moveLeadToSection = async (id: string, sectionId: string) => {
    try {
      const updatedLead = await updateLeadSection(id, sectionId);
      if (updatedLead) {
        setLeads(prev => prev.map(lead => 
          lead.id === id ? updatedLead : lead
        ));
        toast({
          title: "Lead movido",
          description: "Lead movido exitosamente."
        });
        return updatedLead;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo mover el lead."
      });
    }
    return null;
  };

  // Add new section
  const addSection = async (agencyId: string, name: string, color?: string) => {
    try {
      const newSection = await createSection(agencyId, name, color);
      if (newSection) {
        setSections(prev => [...prev, newSection]);
        toast({
          title: "Éxito",
          description: "Sección creada correctamente."
        });
        return newSection;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear la sección."
      });
    }
    return null;
  };

  // Remove section
  const removeSection = async (sectionId: string) => {
    try {
      // First, move any leads in this section to the first available section
      const leadsInSection = leadsBySection[sectionId] || [];
      const remainingSections = sections.filter(s => s.id !== sectionId);
      
      if (leadsInSection.length > 0 && remainingSections.length > 0) {
        const firstSectionId = remainingSections[0].id;
        
        // Move all leads to the first remaining section
        for (const lead of leadsInSection) {
          await moveLeadToSection(lead.id, firstSectionId);
        }
      }
      
      // Now delete the section
      const success = await deleteSection(sectionId);
      if (success) {
        setSections(prev => prev.filter(section => section.id !== sectionId));
        toast({
          title: "Éxito",
          description: `Sección eliminada correctamente.${leadsInSection.length > 0 ? ` ${leadsInSection.length} leads movidos a la primera sección.` : ''}`
        });
        return true;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la sección."
      });
    }
    return false;
  };

  // Group leads by status (backward compatibility)
  const leadsByStatus = {
    new: leads.filter(lead => lead.status === 'new'),
    quoted: leads.filter(lead => lead.status === 'quoted'),
    negotiating: leads.filter(lead => lead.status === 'negotiating'),
    won: leads.filter(lead => lead.status === 'won'),
    lost: leads.filter(lead => lead.status === 'lost')
  };

  // Group leads by section (new functionality)
  const leadsBySection = sections.reduce((acc, section) => {
    acc[section.id] = leads.filter(lead => lead.section_id === section.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  // Calculate total budget per section
  const budgetBySection = sections.reduce((acc, section) => {
    const sectionLeads = leadsBySection[section.id] || [];
    const total = sectionLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
    acc[section.id] = total;
    return acc;
  }, {} as Record<string, number>);

  // Get leads with overdue dates
  const getOverdueLeads = () => {
    const today = new Date().toISOString().split('T')[0];
    return leads.filter(lead => 
      lead.due_date && lead.due_date < today && lead.status !== 'won' && lead.status !== 'lost'
    );
  };

  // Load initial data
  useEffect(() => {
    fetchLeads();
    fetchSellers();
    // Fetch sections for the demo agency
    fetchSections('00000000-0000-0000-0000-000000000002');
  }, []);

  return {
    leads,
    sellers,
    sections,
    leadsByStatus,
    leadsBySection,
    budgetBySection,
    loading,
    addLead,
    editLead,
    removeLead,
    moveLeadToStatus,
    moveLeadToSection,
    addSection,
    removeSection,
    getOverdueLeads,
    refresh: fetchLeads,
    refreshSections: () => fetchSections('00000000-0000-0000-0000-000000000002'),
    refreshSellers: fetchSellers
  };
}