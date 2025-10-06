import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from './useAuthUser';
import type { Role } from '@/types';

export interface UserWithDetails {
  id: string;
  name?: string;
  email: string;
  role: Role;
  agency_id: string | null;
  tenant_id: string | null;
  provider: 'email' | 'google';
  created_at: string;
  agency_name?: string;
  tenant_name?: string;
  agency_status?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: Role;
  agency_id?: string | null;
  tenant_id?: string | null;
}

export interface UpdateUserInput {
  id: string;
  name?: string;
  role?: Role;
  agency_id?: string | null;
  tenant_id?: string | null;
}

/**
 * Hook to manage Users (CRUD operations)
 * Follows the established pattern from useLeads and useReports
 *
 * Permissions enforced by RLS + helper functions:
 * - OWNER: Full CRUD on all users
 * - SUPERADMIN: CRUD on users in their tenant (except OWNER)
 * - ADMIN: Create/Update SELLERS in their agency
 * - SELLER: No user management access
 */
export function useUsers() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedRoles, setAllowedRoles] = useState<Role[]>([]);
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin, isAdmin } = useAuthUser();

  // Determine if user can manage users
  const canManageUsers = isOwner || isSuperAdmin || isAdmin;

  /**
   * Load all users (filtered by RLS automatically)
   */
  const loadUsers = useCallback(async () => {
    if (!user || !canManageUsers) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[USERS] Loading users for role:', user.role);

      const { data, error } = await (supabase as any)
        .from('users_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      let rows = (data || []) as UserWithDetails[];
      // Enforce agency scoping for ADMIN on client side (in addition to RLS)
      if (isAdmin && user.agency_id) {
        rows = rows.filter(u => u.agency_id === user.agency_id);
      }

      setUsers(rows);
      console.log('[USERS] Loaded', data?.length || 0, 'users');
    } catch (error) {
      console.error('[USERS] Error loading users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los usuarios'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, canManageUsers]);

  /**
   * Load allowed roles for creation
   */
  const loadAllowedRoles = useCallback(async () => {
    if (!canManageUsers) return;

    try {
      const { data, error } = await (supabase as any).rpc('get_allowed_roles_for_creation');

      if (error) throw error;

      setAllowedRoles((data || []) as Role[]);
      console.log('[USERS] Allowed roles for creation:', data);
    } catch (error) {
      console.error('[USERS] Error loading allowed roles:', error);
      // Fallback based on role
      if (isOwner) {
        setAllowedRoles(['OWNER', 'SUPERADMIN', 'ADMIN', 'SELLER']);
      } else if (isSuperAdmin) {
        setAllowedRoles(['SUPERADMIN', 'ADMIN', 'SELLER']);
      } else if (isAdmin) {
        setAllowedRoles(['SELLER']);
      }
    }
  }, [canManageUsers, isOwner, isSuperAdmin, isAdmin]);

  /**
   * Create a new user
   * Creates both auth.users and public.users records via Edge Function
   */
  const createUser = async (input: CreateUserInput) => {
    if (!canManageUsers) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para crear usuarios'
      });
      return null;
    }

    try {
      console.log('[USERS] Creating user:', input.email, 'with role:', input.role);

      // Call Edge Function to create user with admin privileges
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          role: input.role,
          agency_id: input.agency_id || null,
          tenant_id: input.tenant_id || null
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create user');

      toast({
        title: 'Éxito',
        description: `Usuario ${input.email} creado correctamente`
      });

      console.log('[USERS] User created successfully:', data.user);

      // Reload users list
      await loadUsers();

      return data.user as UserWithDetails;
    } catch (error: any) {
      console.error('[USERS] Error creating user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario'
      });
      return null;
    }
  };

  /**
   * Update an existing user
   * Only updates public.users (not auth.users)
   */
  const updateUser = async (input: UpdateUserInput) => {
    if (!canManageUsers) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para editar usuarios'
      });
      return null;
    }

    try {
      console.log('[USERS] Updating user:', input.id);

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.agency_id !== undefined) updateData.agency_id = input.agency_id;
      if (input.tenant_id !== undefined) updateData.tenant_id = input.tenant_id;

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Usuario actualizado correctamente'
      });

      console.log('[USERS] User updated successfully');

      // Reload users list
      await loadUsers();

      return data as UserWithDetails;
    } catch (error: any) {
      console.error('[USERS] Error updating user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el usuario'
      });
      return null;
    }
  };

  /**
   * Delete a user (hard delete - only OWNER)
   * For others, should "deactivate" instead
   */
  const deleteUser = async (userId: string) => {
    if (!isOwner) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo el OWNER puede eliminar usuarios permanentemente'
      });
      return false;
    }

    try {
      console.log('[USERS] Deleting user:', userId);

      // Delete from public.users (cascade will handle auth.users via FK)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Usuario eliminado correctamente'
      });

      console.log('[USERS] User deleted successfully');

      // Reload users list
      await loadUsers();

      return true;
    } catch (error: any) {
      console.error('[USERS] Error deleting user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el usuario'
      });
      return false;
    }
  };

  /**
   * Reset user password (OWNER/SUPERADMIN only)
   */
  const resetPassword = async (userId: string, newPassword: string) => {
    if (!isOwner && !isSuperAdmin) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para resetear contraseñas'
      });
      return false;
    }

    try {
      console.log('[USERS] Resetting password for user:', userId);

      // This would require a Supabase Edge Function with service role access
      // For now, we'll show a message
      toast({
        title: 'Función no disponible',
        description: 'El reset de contraseña requiere configuración adicional. El usuario puede usar "Forgot Password".'
      });

      return false;
    } catch (error: any) {
      console.error('[USERS] Error resetting password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo resetear la contraseña'
      });
      return false;
    }
  };

  /**
   * Get users filtered by agency
   */
  const getUsersByAgency = (agencyId: string) => {
    return users.filter(u => u.agency_id === agencyId);
  };

  /**
   * Get users filtered by tenant
   */
  const getUsersByTenant = (tenantId: string) => {
    return users.filter(u => u.tenant_id === tenantId);
  };

  /**
   * Get users filtered by role
   */
  const getUsersByRole = (role: Role) => {
    return users.filter(u => u.role === role);
  };

  // Load initial data
  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
      loadAllowedRoles();
    }
  }, [canManageUsers, loadUsers, loadAllowedRoles]);

  return {
    // State
    users,
    loading,
    allowedRoles,

    // Permissions
    canManageUsers,

    // Actions
    createUser,
    updateUser,
    deleteUser,
    resetPassword,

    // Filters
    getUsersByAgency,
    getUsersByTenant,
    getUsersByRole,

    // Refresh
    refresh: loadUsers
  };
}
