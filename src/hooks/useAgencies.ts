import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createSection } from '@/lib/supabase-leads';
import { useAuthUser } from './useAuthUser';
import type { Agency } from '@/types';

export interface AgencyWithDetails extends Agency {
  tenant_name?: string;
  users_count?: number;
  leads_count?: number;
}

export interface CreateAgencyInput {
  tenant_id: string;
  name: string;
  phones?: string[];
  branding?: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    contact: {
      name: string;
      email: string;
      phone: string;
    };
  };
}

export interface UpdateAgencyInput {
  id: string;
  name?: string;
  status?: 'active' | 'suspended';
  tenant_id?: string | null;
  phones?: string[];
  branding?: any;
}

/**
 * Hook to manage Agencies (CRUD operations)
 * Follows the established pattern from useLeads and useUsers
 *
 * Permissions enforced by RLS + helper functions:
 * - OWNER: Full CRUD on all agencies
 * - SUPERADMIN: CRUD on agencies in their tenant (no hard delete)
 * - ADMIN: Read-only their own agency
 * - SELLER: No access
 */
export function useAgencies() {
  const [agencies, setAgencies] = useState<AgencyWithDetails[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin } = useAuthUser();

  // Determine if user can manage agencies
  const canManageAgencies = isOwner || isSuperAdmin;
  const canCreateAgencies = isOwner || isSuperAdmin;
  const canDeleteAgencies = isOwner; // Only OWNER can hard delete

  /**
   * Load all agencies (filtered by RLS automatically)
   */
  const loadAgencies = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[AGENCIES] Loading agencies for role:', user.role);

      // Load agencies with tenant information
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          tenants (
            name
          )
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      // Transform data to include tenant_name
      const agenciesWithDetails: AgencyWithDetails[] = (data || []).map((agency: any) => ({
        ...agency,
        tenant_name: agency.tenants?.name
      }));

      setAgencies(agenciesWithDetails);
      console.log('[AGENCIES] Loaded', agenciesWithDetails.length, 'agencies');
    } catch (error) {
      console.error('[AGENCIES] Error loading agencies:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las agencias'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Load available tenants for agency creation
   */
  const loadTenants = useCallback(async () => {
    if (!canCreateAgencies) return;

    try {
      console.log('[AGENCIES] Loading tenants');

      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;

      setTenants(data || []);
      console.log('[AGENCIES] Loaded', data?.length || 0, 'tenants');
    } catch (error) {
      console.error('[AGENCIES] Error loading tenants:', error);
      // Don't show error toast for tenants as it's supplementary data
    }
  }, [canCreateAgencies]);

  /**
   * Create a new agency
   */
  const createAgency = async (input: CreateAgencyInput) => {
    if (!canCreateAgencies) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para crear agencias'
      });
      return null;
    }

    try {
      console.log('[AGENCIES] Creating agency:', input.name);

      const { data, error } = await supabase
        .from('agencies')
        .insert({
          tenant_id: input.tenant_id,
          name: input.name,
          status: 'active',
          phones: input.phones || [],
          branding: input.branding || {
            logoUrl: '',
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af',
            contact: {
              name: input.name,
              email: 'contact@agency.com',
              phone: input.phones?.[0] || ''
            }
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Agencia ${input.name} creada correctamente`
      });

      console.log('[AGENCIES] Agency created successfully:', data);

      // Bootstrap default CRM sections for this new agency
      try {
        const defaultSections = ['Nuevos', 'En progreso', 'Cotizado', 'Negociación', 'Ganado', 'Perdido'];
        for (const name of defaultSections) {
          await createSection(data.id, name);
        }
        console.log('[AGENCIES] Default CRM sections created for agency');
      } catch (e) {
        console.warn('[AGENCIES] Could not create default sections for agency:', e);
      }

      // Reload agencies list
      await loadAgencies();

      return data as Agency;
    } catch (error: any) {
      console.error('[AGENCIES] Error creating agency:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear la agencia'
      });
      return null;
    }
  };

  /**
   * Update an existing agency
   */
  const updateAgency = async (input: UpdateAgencyInput) => {
    if (!canManageAgencies) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para editar agencias'
      });
      return null;
    }

    try {
      console.log('[AGENCIES] Updating agency:', input.id);

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.tenant_id !== undefined) updateData.tenant_id = input.tenant_id;
      if (input.phones !== undefined) updateData.phones = input.phones;
      if (input.branding !== undefined) updateData.branding = input.branding;

      const { data, error } = await supabase
        .from('agencies')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Agencia actualizada correctamente'
      });

      console.log('[AGENCIES] Agency updated successfully');

      // Reload agencies list
      await loadAgencies();

      return data as Agency;
    } catch (error: any) {
      console.error('[AGENCIES] Error updating agency:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar la agencia'
      });
      return null;
    }
  };

  /**
   * Suspend/Activate an agency (soft delete)
   */
  const toggleAgencyStatus = async (agencyId: string, newStatus: 'active' | 'suspended') => {
    if (!canManageAgencies) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para cambiar el estado de agencias'
      });
      return null;
    }

    try {
      console.log('[AGENCIES] Toggling agency status:', agencyId, newStatus);

      const { data, error } = await supabase
        .from('agencies')
        .update({ status: newStatus })
        .eq('id', agencyId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Agencia ${newStatus === 'active' ? 'activada' : 'suspendida'} correctamente`
      });

      console.log('[AGENCIES] Agency status toggled successfully');

      // Reload agencies list
      await loadAgencies();

      return data as Agency;
    } catch (error: any) {
      console.error('[AGENCIES] Error toggling agency status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo cambiar el estado de la agencia'
      });
      return null;
    }
  };

  /**
   * Delete an agency (hard delete - only OWNER)
   */
  const deleteAgency = async (agencyId: string) => {
    if (!canDeleteAgencies) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede eliminar agencias permanentemente. Usa "Suspend" en su lugar.'
      });
      return false;
    }

    try {
      console.log('[AGENCIES] Deleting agency:', agencyId);

      // Check if agency has users
      const { data: usersCheck, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agencyId)
        .limit(1);

      if (usersError) throw usersError;

      if (usersCheck && usersCheck.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'La agencia tiene usuarios asignados. Primero debes reasignarlos o eliminarlos.'
        });
        return false;
      }

      // Check if agency has leads
      const { data: leadsCheck, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .eq('agency_id', agencyId)
        .limit(1);

      if (leadsError) throw leadsError;

      if (leadsCheck && leadsCheck.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'La agencia tiene leads. Primero debes eliminarlos o reasignarlos.'
        });
        return false;
      }

      // Safe to delete
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', agencyId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Agencia eliminada correctamente'
      });

      console.log('[AGENCIES] Agency deleted successfully');

      // Reload agencies list
      await loadAgencies();

      return true;
    } catch (error: any) {
      console.error('[AGENCIES] Error deleting agency:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar la agencia'
      });
      return false;
    }
  };

  /**
   * Get agencies filtered by tenant
   */
  const getAgenciesByTenant = (tenantId: string) => {
    return agencies.filter(a => a.tenant_id === tenantId);
  };

  /**
   * Get active agencies only
   */
  const getActiveAgencies = () => {
    return agencies.filter(a => a.status === 'active');
  };

  /**
   * Get suspended agencies only
   */
  const getSuspendedAgencies = () => {
    return agencies.filter(a => a.status === 'suspended');
  };

  // Load initial data
  useEffect(() => {
    loadAgencies();
    if (canCreateAgencies) {
      loadTenants();
    }
  }, [loadAgencies, loadTenants, canCreateAgencies]);

  return {
    // State
    agencies,
    tenants,
    loading,

    // Permissions
    canManageAgencies,
    canCreateAgencies,
    canDeleteAgencies,

    // Actions
    createAgency,
    updateAgency,
    toggleAgencyStatus,
    deleteAgency,

    // Filters
    getAgenciesByTenant,
    getActiveAgencies,
    getSuspendedAgencies,

    // Refresh
    refresh: loadAgencies
  };
}
