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
import { useAuthUser } from '@/hooks/useAuthUser';

export function useLeads(selectedAgencyId?: string | 'all') {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuthUser();
  const isUuid = (v: string) => typeof v === 'string' && /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v);
  const DEFAULT_SECTION_NAMES = ['Nuevos', 'En progreso', 'Cotizado', 'Negociación', 'Ganado', 'Perdido'];

  const resolveSectionIdForLead = async (leadId: string, sectionKey: string): Promise<string | null> => {
    try {
      const lead = leads.find(l => l.id === leadId);
      const agencyId = lead?.agency_id || user?.agency_id || null;
      if (!agencyId) return null;
      const secs = await getSections(agencyId);
      const target = secs.find(s => s.name === sectionKey);
      return target ? target.id : null;
    } catch {
      return null;
    }
  };

  // Fetch leads from Supabase
  const fetchLeads = async () => {
    setLoading(true);
    try {
      // OWNER/SUPERADMIN: if 'all' is selected, fetch all leads (undefined agencyId)
      const isOwnerOrSuper = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';
      const scopeAgencyId = selectedAgencyId === 'all' && isOwnerOrSuper
        ? undefined
        : ((selectedAgencyId && selectedAgencyId !== 'all') ? selectedAgencyId : (user?.agency_id || undefined));
      const data = await getLeads(scopeAgencyId);
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

      const defaultSectionNames = [
        'Nuevos',
        'En progreso',
        'Cotizado',
        'Negociación',
        'Ganado',
        'Perdido'
      ];

      if (data && data.length > 0) {
        // Create any missing default sections
        const present = new Set((data || []).map(s => s.name));
        const missing = defaultSectionNames.filter(n => !present.has(n));
        for (const name of missing) {
          await createSection(agencyId, name);
        }
        // Reload to include any created ones
        const reloaded = await getSections(agencyId);
        setSections(reloaded);
        return;
      }

      // If none exist, bootstrap all defaults
      for (const name of defaultSectionNames) {
        await createSection(agencyId, name);
      }
      const reloaded = await getSections(agencyId);
      setSections(reloaded);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  // Create new lead
  const addLead = async (input: CreateLeadInput) => {
    try {
      // Normalize section_id if provided as standard name (from synthetic 'all' board)
      if (input.section_id && typeof input.section_id === 'string' && !isUuid(input.section_id) && DEFAULT_SECTION_NAMES.includes(input.section_id)) {
        if (input.agency_id) {
          const secs = await getSections(input.agency_id);
          const target = secs.find(s => s.name === input.section_id);
          input.section_id = target ? target.id : undefined as any;
        } else {
          input.section_id = undefined as any;
        }
      }
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
      // Normalize section_id if coming as a standard name (from synthetic 'all' board')
      if (input.section_id && typeof input.section_id === 'string' && !isUuid(input.section_id) && DEFAULT_SECTION_NAMES.includes(input.section_id)) {
        const resolvedId = await resolveSectionIdForLead(input.id, input.section_id);
        if (resolvedId) {
          input.section_id = resolvedId;
        } else {
          delete (input as any).section_id;
        }
      }
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
      console.error('useLeads editLead error:', error);
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
      // If we're in ALL agencies mode (synthetic columns), moving between columns should change STATUS, not section_id
      if (selectedAgencyId === 'all') {
        const colName = sectionId;
        const statusMap: Record<string, LeadStatus> = {
          'Nuevos': 'new',
          'En progreso': 'negotiating',
          'Cotizado': 'quoted',
          'Negociación': 'negotiating',
          'Ganado': 'won',
          'Perdido': 'lost',
        };
        const newStatus = statusMap[colName];
        if (newStatus) {
          const updatedLead = await updateLeadStatus(id, newStatus);
          if (updatedLead) {
            setLeads(prev => prev.map(lead =>
              lead.id === id ? { ...lead, status: newStatus } as Lead : lead
            ));
            toast({ title: 'Lead movido', description: 'Lead movido exitosamente.' });
            return updatedLead;
          }
        }
        // If no status mapping, do nothing
        return null;
      }

      // Single-agency board: moving column changes section_id
      let targetSectionId = sectionId;
      if (typeof sectionId === 'string' && !isUuid(sectionId) && DEFAULT_SECTION_NAMES.includes(sectionId)) {
        const resolvedId = await resolveSectionIdForLead(id, sectionId);
        if (resolvedId) targetSectionId = resolvedId;
      }
      const updatedLead = await updateLeadSection(id, targetSectionId);
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

  // Group leads by section (supports 'all' mode -> group by status)
  const leadsBySection = (() => {
    const isAll = selectedAgencyId === 'all';
    if (isAll) {
      const map: Record<string, Lead[]> = {
        'Nuevos': leads.filter(l => l.status === 'new'),
        'En progreso': leads.filter(l => l.status === 'negotiating'),
        'Cotizado': leads.filter(l => l.status === 'quoted'),
        'Negociación': leads.filter(l => l.status === 'negotiating'),
        'Ganado': leads.filter(l => l.status === 'won'),
        'Perdido': leads.filter(l => l.status === 'lost'),
      } as Record<string, Lead[]>;
      // Build by section ids
      const acc: Record<string, Lead[]> = {};
      sections.forEach(sec => {
        acc[sec.id] = map[sec.name] || [];
      });
      return acc;
    }
    return sections.reduce((acc, section) => {
      acc[section.id] = leads.filter(lead => lead.section_id === section.id);
      return acc;
    }, {} as Record<string, Lead[]>);
  })();

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
    if (!user) return;
    fetchLeads();
    fetchSellers();
    if (selectedAgencyId === 'all') {
      // Synthesize default sections for all-agencies board
      const defaultSectionNames = ['Nuevos', 'En progreso', 'Cotizado', 'Negociación', 'Ganado', 'Perdido'];
      setSections(defaultSectionNames.map((name, idx) => ({
        id: name,
        agency_id: 'all',
        name,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        position: idx + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as unknown as Section));
    } else {
      const agencyForSections = (selectedAgencyId && selectedAgencyId !== 'all')
        ? selectedAgencyId
        : (user.agency_id || '');
      if (agencyForSections) {
        fetchSections(agencyForSections);
      } else {
        setSections([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.agency_id, user?.id, selectedAgencyId]);

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
    refreshSections: () => {
      const agencyForSections = (selectedAgencyId && selectedAgencyId !== 'all')
        ? selectedAgencyId
        : (user?.agency_id || '');
      return agencyForSections ? fetchSections(agencyForSections) : Promise.resolve();
    },
    refreshSellers: fetchSellers
  };
}