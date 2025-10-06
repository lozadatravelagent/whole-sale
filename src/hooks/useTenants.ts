import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from './useAuthUser';

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface TenantWithDetails extends Tenant {
  agencies_count?: number;
  users_count?: number;
}

export interface CreateTenantInput {
  name: string;
}

export interface UpdateTenantInput {
  id: string;
  name?: string;
  status?: 'active' | 'suspended';
}

/**
 * Hook to manage Tenants (CRUD operations)
 * Only OWNER can manage tenants
 * SUPERADMIN can view their own tenant
 */
export function useTenants() {
  const [tenants, setTenants] = useState<TenantWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin } = useAuthUser();

  // Only OWNER can manage tenants
  const canManageTenants = isOwner;
  const canViewTenants = isOwner || isSuperAdmin;

  /**
   * Load all tenants (OWNER sees all, SUPERADMIN sees only theirs)
   */
  const loadTenants = useCallback(async () => {
    if (!user || !canViewTenants) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[TENANTS] Loading tenants for role:', user.role);

      let query = supabase
        .from('tenants')
        .select('*')
        .order('name', { ascending: true });

      // SUPERADMIN only sees their own tenant
      if (isSuperAdmin && user.tenant_id) {
        query = query.eq('id', user.tenant_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Load counts for each tenant
      const tenantsWithDetails = await Promise.all(
        (data || []).map(async (tenant) => {
          // Count agencies
          const { count: agenciesCount } = await supabase
            .from('agencies')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          // Count users
          const { count: usersCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          return {
            ...tenant,
            agencies_count: agenciesCount || 0,
            users_count: usersCount || 0
          };
        })
      );

      setTenants(tenantsWithDetails);
      console.log('[TENANTS] Loaded', tenantsWithDetails.length, 'tenants');
    } catch (error) {
      console.error('[TENANTS] Error loading tenants:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los tenants'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, canViewTenants, isSuperAdmin, user?.tenant_id]);

  /**
   * Create a new tenant (OWNER only)
   */
  const createTenant = async (input: CreateTenantInput) => {
    if (!canManageTenants) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede crear tenants'
      });
      return null;
    }

    try {
      console.log('[TENANTS] Creating tenant:', input.name);

      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: input.name,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Tenant ${input.name} creado correctamente`
      });

      console.log('[TENANTS] Tenant created successfully:', data);

      // Reload tenants list
      await loadTenants();

      return data as Tenant;
    } catch (error: any) {
      console.error('[TENANTS] Error creating tenant:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear el tenant'
      });
      return null;
    }
  };

  /**
   * Update an existing tenant (OWNER only)
   */
  const updateTenant = async (input: UpdateTenantInput) => {
    if (!canManageTenants) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede editar tenants'
      });
      return null;
    }

    try {
      console.log('[TENANTS] Updating tenant:', input.id);

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.status !== undefined) updateData.status = input.status;

      const { data, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Tenant actualizado correctamente'
      });

      console.log('[TENANTS] Tenant updated successfully');

      // Reload tenants list
      await loadTenants();

      return data as Tenant;
    } catch (error: any) {
      console.error('[TENANTS] Error updating tenant:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el tenant'
      });
      return null;
    }
  };

  /**
   * Toggle tenant status (OWNER only)
   */
  const toggleTenantStatus = async (tenantId: string, newStatus: 'active' | 'suspended') => {
    if (!canManageTenants) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede cambiar el estado de tenants'
      });
      return null;
    }

    try {
      console.log('[TENANTS] Toggling tenant status:', tenantId, newStatus);

      const { data, error } = await supabase
        .from('tenants')
        .update({ status: newStatus })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Tenant ${newStatus === 'active' ? 'activado' : 'suspendido'} correctamente`
      });

      console.log('[TENANTS] Tenant status toggled successfully');

      // Reload tenants list
      await loadTenants();

      return data as Tenant;
    } catch (error: any) {
      console.error('[TENANTS] Error toggling tenant status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo cambiar el estado del tenant'
      });
      return null;
    }
  };

  /**
   * Delete a tenant (OWNER only, with safeguards)
   */
  const deleteTenant = async (tenantId: string) => {
    if (!canManageTenants) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede eliminar tenants'
      });
      return false;
    }

    try {
      console.log('[TENANTS] Deleting tenant:', tenantId);

      // Check if tenant has agencies
      const { data: agenciesCheck, error: agenciesError } = await supabase
        .from('agencies')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (agenciesError) throw agenciesError;

      if (agenciesCheck && agenciesCheck.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'El tenant tiene agencias asignadas. Primero debes reasignarlas o eliminarlas.'
        });
        return false;
      }

      // Check if tenant has users
      const { data: usersCheck, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (usersError) throw usersError;

      if (usersCheck && usersCheck.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'El tenant tiene usuarios asignados. Primero debes reasignarlos o eliminarlos.'
        });
        return false;
      }

      // Safe to delete
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Tenant eliminado correctamente'
      });

      console.log('[TENANTS] Tenant deleted successfully');

      // Reload tenants list
      await loadTenants();

      return true;
    } catch (error: any) {
      console.error('[TENANTS] Error deleting tenant:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el tenant'
      });
      return false;
    }
  };

  /**
   * Get active tenants only
   */
  const getActiveTenants = () => {
    return tenants.filter(t => t.status === 'active');
  };

  /**
   * Get suspended tenants only
   */
  const getSuspendedTenants = () => {
    return tenants.filter(t => t.status === 'suspended');
  };

  // Load initial data
  useEffect(() => {
    if (canViewTenants) {
      loadTenants();
    }
  }, [canViewTenants, loadTenants]);

  return {
    // State
    tenants,
    loading,

    // Permissions
    canManageTenants,
    canViewTenants,

    // Actions
    createTenant,
    updateTenant,
    toggleTenantStatus,
    deleteTenant,

    // Filters
    getActiveTenants,
    getSuspendedTenants,

    // Refresh
    refresh: loadTenants
  };
}
