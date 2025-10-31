import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Role } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  agency_id: string | null;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  // Role checks
  isOwner: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  // Permission checks
  canViewAllTenants: boolean;
  canViewAllAgencies: boolean;
  canViewAgency: (agencyId: string) => boolean;
  canViewLead: (lead: { assigned_user_id?: string; agency_id: string }) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider manages global authentication state
 * Persists user data across route changes to prevent flickering
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        setLoading(true);
        setError(null);

        // Get authenticated session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Fetch user data from public.users table (with role info)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, role, tenant_id, agency_id, name')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;

        if (!userData) {
          throw new Error('User data not found in database');
        }

        if (mounted) {
          setUser({
            id: userData.id,
            email: userData.email,
            role: userData.role as Role,
            tenant_id: userData.tenant_id,
            agency_id: userData.agency_id,
            name: userData.name
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading user:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load user');
          setUser(null);
          setLoading(false);
        }
      }
    }

    loadUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          loadUser();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Helper functions for role checks
  const isOwner = user?.role === 'OWNER';
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isSeller = user?.role === 'SELLER';

  // Permission checks
  const canViewAllTenants = isOwner;
  const canViewAllAgencies = isOwner || isSuperAdmin;
  const canViewAgency = (agencyId: string) => {
    if (isOwner || isSuperAdmin) return true;
    return user?.agency_id === agencyId;
  };
  const canViewLead = (lead: { assigned_user_id?: string; agency_id: string }) => {
    if (isOwner || isSuperAdmin) return true;
    if (isAdmin && user?.agency_id === lead.agency_id) return true;
    if (isSeller && lead.assigned_user_id === user?.id) return true;
    return false;
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isOwner,
    isSuperAdmin,
    isAdmin,
    isSeller,
    canViewAllTenants,
    canViewAllAgencies,
    canViewAgency,
    canViewLead
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * Must be used within an AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
