import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from './useAuthUser';
import type { Agency } from '@/types';

export interface AgencyBranding {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  role: string;
  agency_id: string | null;
  tenant_id: string | null;
}

export interface AgencyOption {
  id: string;
  name: string;
  tenant_id: string;
  tenant_name?: string;
}

export interface UpdateBrandingInput {
  agency_id: string;
  branding: AgencyBranding;
}

export interface UpdateProfileInput {
  name?: string;
}

/**
 * Hook to manage Settings (Agency branding and User profile)
 * Follows the established pattern from useLeads and useReports
 *
 * Permissions:
 * - OWNER: Can edit branding of ANY agency (needs to select from dropdown)
 * - SUPERADMIN: Can edit branding of agencies in their tenant (dropdown)
 * - ADMIN: Can edit branding of their own agency (no dropdown)
 * - SELLER: Can only edit their personal profile (name, password)
 * - ALL ROLES: Can edit their own profile
 */
export function useSettings() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [branding, setBranding] = useState<AgencyBranding | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuthUser();

  // Determine if user can edit agency settings
  const canEditAgencySettings = isOwner || isSuperAdmin || isAdmin;

  /**
   * Load available agencies for OWNER/SUPERADMIN to select from
   */
  const loadAvailableAgencies = async () => {
    if (!user) return;

    try {
      if (isOwner) {
        // OWNER can see ALL agencies across all tenants
        const { data, error } = await supabase
          .from('agencies')
          .select('id, name, tenant_id, tenants(name)')
          .order('name', { ascending: true });

        if (error) throw error;

        const agencyOptions: AgencyOption[] = (data || []).map((agency: any) => ({
          id: agency.id,
          name: agency.name,
          tenant_id: agency.tenant_id,
          tenant_name: agency.tenants?.name
        }));

        setAgencies(agencyOptions);
        console.log('[SETTINGS] Loaded', agencyOptions.length, 'agencies for OWNER');

        // Auto-select first agency if none selected
        if (!selectedAgencyId && agencyOptions.length > 0) {
          setSelectedAgencyId(agencyOptions[0].id);
        }

      } else if (isSuperAdmin && user.tenant_id) {
        // SUPERADMIN can see agencies in their tenant
        const { data, error } = await supabase
          .from('agencies')
          .select('id, name, tenant_id')
          .eq('tenant_id', user.tenant_id)
          .order('name', { ascending: true });

        if (error) throw error;

        const agencyOptions: AgencyOption[] = (data || []).map((agency) => ({
          id: agency.id,
          name: agency.name,
          tenant_id: agency.tenant_id
        }));

        setAgencies(agencyOptions);
        console.log('[SETTINGS] Loaded', agencyOptions.length, 'agencies for SUPERADMIN');

        // Auto-select first agency if none selected
        if (!selectedAgencyId && agencyOptions.length > 0) {
          setSelectedAgencyId(agencyOptions[0].id);
        }

      } else if (isAdmin && user.agency_id) {
        // ADMIN only has their own agency (no dropdown needed)
        setSelectedAgencyId(user.agency_id);
      }
    } catch (error) {
      console.error('[SETTINGS] Error loading agencies:', error);
    }
  };

  /**
   * Load agency data and branding based on selected agency
   */
  const loadAgencyData = async (agencyId?: string) => {
    const targetAgencyId = agencyId || selectedAgencyId;

    if (!targetAgencyId) {
      console.log('[SETTINGS] No agency selected, skipping agency data load');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', targetAgencyId)
        .single();

      if (error) throw error;

      setAgency(data as Agency);

      // Parse branding from JSONB or use defaults
      const brandingData = typeof data.branding === 'object' && data.branding !== null
        ? data.branding as AgencyBranding
        : {
            logoUrl: '',
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af',
            contact: {
              name: data.name || 'Travel Agency',
              email: 'contact@agency.com',
              phone: '+1234567890'
            }
          };

      setBranding(brandingData);
      console.log('[SETTINGS] Agency data loaded:', { agency: data.name, branding: brandingData });
    } catch (error) {
      console.error('[SETTINGS] Error loading agency data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar la información de la agencia'
      });
    }
  };

  /**
   * Load user profile data
   */
  const loadUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, agency_id, tenant_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data as UserProfile);
      console.log('[SETTINGS] User profile loaded:', data);
    } catch (error) {
      console.error('[SETTINGS] Error loading user profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el perfil de usuario'
      });
    }
  };

  /**
   * Update agency branding
   * Only OWNER, SUPERADMIN, and ADMIN can do this
   */
  const updateAgencyBranding = async (input: UpdateBrandingInput) => {
    if (!canEditAgencySettings) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para editar la configuración de la agencia'
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('agencies')
        .update({ branding: input.branding as any })
        .eq('id', input.agency_id)
        .select()
        .single();

      if (error) throw error;

      setAgency(data as Agency);
      setBranding(input.branding);

      toast({
        title: 'Éxito',
        description: 'Configuración de marca actualizada correctamente'
      });

      console.log('[SETTINGS] Branding updated successfully');
      return true;
    } catch (error) {
      console.error('[SETTINGS] Error updating branding:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la configuración de marca'
      });
      return false;
    }
  };

  /**
   * Update user profile (name)
   * All roles can update their own profile
   */
  const updateUserProfile = async (input: UpdateProfileInput) => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Usuario no autenticado'
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ name: input.name })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data as UserProfile);

      toast({
        title: 'Éxito',
        description: 'Perfil actualizado correctamente'
      });

      console.log('[SETTINGS] Profile updated successfully');
      return true;
    } catch (error) {
      console.error('[SETTINGS] Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el perfil'
      });
      return false;
    }
  };

  /**
   * Update user password
   * Uses Supabase Auth API (all roles can change their own password)
   */
  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Contraseña actualizada correctamente'
      });

      console.log('[SETTINGS] Password updated successfully');
      return true;
    } catch (error) {
      console.error('[SETTINGS] Error updating password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la contraseña'
      });
      return false;
    }
  };

  /**
   * Upload agency logo to Supabase Storage
   * Returns the public URL of the uploaded file
   */
  const uploadLogo = async (file: File, agencyId: string): Promise<string | null> => {
    if (!canEditAgencySettings) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tienes permisos para subir el logo'
      });
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${agencyId}/logo-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('agency-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('agency-logos')
        .getPublicUrl(data.path);

      console.log('[SETTINGS] Logo uploaded:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('[SETTINGS] Error uploading logo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo subir el logo'
      });
      return null;
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await loadAvailableAgencies();
        await loadUserProfile();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, user?.agency_id, user?.role]);

  // Load agency data when selectedAgencyId changes
  useEffect(() => {
    if (selectedAgencyId) {
      loadAgencyData(selectedAgencyId);
    }
  }, [selectedAgencyId]);

  return {
    // State
    agency,
    branding,
    profile,
    agencies,
    selectedAgencyId,
    loading,

    // Permissions
    canEditAgencySettings,
    needsAgencySelector: isOwner || isSuperAdmin,

    // Actions
    setSelectedAgencyId,
    updateAgencyBranding,
    updateUserProfile,
    updatePassword,
    uploadLogo,

    // Refresh functions
    refresh: () => {
      loadAvailableAgencies();
      loadAgencyData();
      loadUserProfile();
    },
    refreshAgency: () => loadAgencyData(),
    refreshProfile: loadUserProfile
  };
}
