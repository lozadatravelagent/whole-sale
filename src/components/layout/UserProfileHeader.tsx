import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Crown, Shield, UserCog, User } from 'lucide-react';
import type { AuthUser } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileHeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

export function UserProfileHeader({ user, onLogout }: UserProfileHeaderProps) {
  const navigate = useNavigate();
  const [agencyName, setAgencyName] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');

  useEffect(() => {
    async function loadNames() {
      // Cargar nombre de agencia si existe
      if (user.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', user.agency_id)
          .single();
        if (agency) setAgencyName(agency.name);
      }

      // Cargar nombre de tenant si existe
      if (user.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', user.tenant_id)
          .single();
        if (tenant) setTenantName(tenant.name);
      }
    }

    loadNames();
  }, [user.agency_id, user.tenant_id]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'SUPERADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Administrador';
      case 'SELLER':
        return 'Vendedor';
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default' as const;
      case 'SUPERADMIN':
        return 'secondary' as const;
      case 'ADMIN':
        return 'outline' as const;
      case 'SELLER':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />;
      case 'SUPERADMIN':
        return <Shield className="h-3 w-3 text-purple-600 dark:text-purple-400" />;
      case 'ADMIN':
        return <UserCog className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
      case 'SELLER':
        return <User className="h-3 w-3 text-green-600 dark:text-green-400" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getUserInitials = () => {
    // Get initials from email (first 2 characters before @)
    const emailName = user.email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Badge de Rol */}
      <Badge
        variant={getRoleBadgeVariant(user.role)}
        className="hidden sm:flex items-center gap-1 text-xs"
      >
        {getRoleIcon(user.role)}
        <span className="hidden md:inline">{getRoleLabel(user.role)}</span>
      </Badge>

      {/* Dropdown de Usuario */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
            <Avatar className="h-8 w-8 md:h-9 md:w-9 cursor-pointer">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {getRoleIcon(user.role)}
                <p className="text-sm font-medium">{user.email.split('@')[0]}</p>
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="mt-1 pt-1 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Rol:</span>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
                {tenantName && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Mayorista:</span>
                    <span className="text-xs font-medium truncate max-w-[150px]">{tenantName}</span>
                  </div>
                )}
                {agencyName && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Agencia:</span>
                    <span className="text-xs font-medium truncate max-w-[150px]">{agencyName}</span>
                  </div>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
            Mi Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive">
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
