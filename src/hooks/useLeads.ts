import { useState, useEffect } from 'react';
import { Lead, LeadStatus } from '@/types';
import { getLeads, createLead, updateLead, deleteLead, updateLeadStatus, CreateLeadInput, UpdateLeadInput } from '@/lib/supabase-leads';
import { useToast } from '@/hooks/use-toast';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
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

  // Update lead status (for drag & drop)
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

  // Group leads by status
  const leadsByStatus = {
    new: leads.filter(lead => lead.status === 'new'),
    quoted: leads.filter(lead => lead.status === 'quoted'),
    negotiating: leads.filter(lead => lead.status === 'negotiating'),
    won: leads.filter(lead => lead.status === 'won'),
    lost: leads.filter(lead => lead.status === 'lost')
  };

  // Load leads on mount
  useEffect(() => {
    fetchLeads();
  }, []);

  return {
    leads,
    leadsByStatus,
    loading,
    addLead,
    editLead,
    removeLead,
    moveLeadToStatus,
    refresh: fetchLeads
  };
}