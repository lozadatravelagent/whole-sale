import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Store,
  BarChart3,
  Settings,
  LogOut,
  Building,
  Phone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  userRole?: 'SUPERADMIN' | 'ADMIN';
  sidebarExtra?: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'CRM', href: '/crm', icon: Users },
  { name: 'Marketplace', href: '/marketplace', icon: Store },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Licenses', href: '/admin/licenses', icon: Building },
  { name: 'WhatsApp', href: '/admin/whatsapp', icon: Phone },
];

export default function MainLayout({ children, userRole, sidebarExtra }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [sidebarHidden, setSidebarHidden] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      toast({
        title: "Logout exitoso",
        description: "Sesión cerrada correctamente.",
      });

      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error during logout:', error);
      toast({
        title: "Error al cerrar sesión",
        description: (error as Error)?.message || "Hubo un problema cerrando la sesión.",
        variant: "destructive",
      });
    }
  };

  const [chatOpen, setChatOpen] = useState(location.pathname.startsWith('/chat'));

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-card border-r border-border flex flex-col transform transition-transform",
        sidebarHidden ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="flex h-16 items-center px-6 justify-between">
          <div className="text-xl font-bold text-primary">
            VBOOK
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarHidden(true)} className="text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <nav className="px-4 pb-4 space-y-1">
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

          {userRole === 'SUPERADMIN' && (
            <>
              <div className="h-px bg-border my-4" />
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin
              </div>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
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
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border">
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
      <div className={cn(sidebarHidden ? "pl-0" : "pl-64")}>
        {sidebarHidden && (
          <div className="fixed top-4 left-4 z-40">
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