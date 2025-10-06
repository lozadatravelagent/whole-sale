import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from '@/hooks/useAuthUser';
import { UserProfileHeader } from '@/components/layout/UserProfileHeader';

import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Store,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Crown,
  Shield,
  UserCog,
  User as UserIcon,
  Building,
  Building2
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  userRole?: 'SUPERADMIN' | 'ADMIN';
  sidebarExtra?: React.ReactNode;
}

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'CRM', href: '/crm', icon: Users },
  { name: 'Marketplace', href: '/marketplace', icon: Store },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Users', href: '/users', icon: UserCog, roles: ['OWNER', 'SUPERADMIN', 'ADMIN'] },
  { name: 'Agencies', href: '/agencies', icon: Building, roles: ['OWNER', 'SUPERADMIN'] },
  { name: 'Tenants', href: '/tenants', icon: Building2, roles: ['OWNER'] },
  { name: 'Settings', href: '/settings', icon: Settings },
];


export default function MainLayout({ children, userRole, sidebarExtra }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuthUser();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      // Check session first; avoid global scope signOut from client
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Hard redirect to avoid any in-app redirects
        window.location.replace('/login');
        return;
      }

      // Prefer default signOut; some backends reject scoped signOut from browsers
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Proactively clear any lingering Supabase auth tokens in localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch { }

      window.location.replace('/login');
    } catch (error: any) {
      // If backend returns 401/403 or AuthSessionMissingError, proceed to client-side redirect
      const msg = (error?.message || '').toString();
      const isAuthMissing = msg.includes('Auth session missing') || msg.includes('401') || msg.includes('403');
      if (isAuthMissing) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch { }
        window.location.replace('/login');
        return;
      }
      console.error('Error during logout:', error);
      toast({
        title: "Error al cerrar sesión",
        description: msg || "Hubo un problema cerrando la sesión.",
        variant: "destructive",
      });
    }
  };

  const [chatOpen, setChatOpen] = useState(location.pathname.startsWith('/chat'));

  // Filter navigation based on user role
  const navigation = baseNavigation.filter(item => {
    if (!item.roles) return true; // Show items without role restrictions
    return item.roles.includes(user?.role || '');
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />;
      case 'SUPERADMIN':
        return <Shield className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
      case 'ADMIN':
        return <UserCog className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
      case 'SELLER':
        return <UserIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
      default:
        return <UserIcon className="h-3.5 w-3.5" />;
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-gradient-card border-b border-border flex items-center justify-between px-4">
        <div className="text-xl font-bold text-primary">
          VIBOOK
        </div>
        <div className="flex items-center gap-2">
          {user && <UserProfileHeader user={user} onLogout={handleLogout} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-card border-r border-border flex flex-col transition-transform duration-300",
        // Mobile behavior (siempre oculto por defecto)
        "-translate-x-full",
        mobileMenuOpen && "translate-x-0",
        "top-16 lg:top-0",
        // Desktop behavior
        !sidebarHidden ? "lg:translate-x-0" : "lg:-translate-x-full"
      )}>
        <div className="hidden lg:flex h-16 items-center px-6 justify-between border-b border-border">
          <div className="text-xl font-bold text-primary">
            VIBOOK
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarHidden(true)} className="text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Role Badge en Sidebar */}
        {user && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
              {getRoleIcon(user.role)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{getRoleLabel(user.role)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 pb-4 pt-2 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            if (item.name === 'Chat') {
              return (
                <div key={item.name} className="w-full">
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-between h-10",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    onClick={() => {
                      if (!location.pathname.startsWith('/chat')) {
                        navigate('/chat');
                        setChatOpen(true);
                        return;
                      }
                      setChatOpen(prev => !prev);
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </span>
                  </Button>
                </div>
              );
            }
            return (
              <Link key={item.name} to={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {sidebarExtra && (
          <div className="flex-1 overflow-y-auto border-t border-border">
            {sidebarExtra}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className={cn(
        "min-h-screen",
        "pt-16 lg:pt-0", // Add top padding on mobile for fixed header
        sidebarHidden ? "lg:pl-0" : "lg:pl-64"
      )}>
        {sidebarHidden && (
          <div className="hidden lg:block fixed top-4 left-4 z-40">
            <Button size="icon" variant="secondary" onClick={() => setSidebarHidden(false)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}