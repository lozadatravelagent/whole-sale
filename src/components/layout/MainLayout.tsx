import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  Menu,
  X
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-gradient-card border-b border-border flex items-center justify-between px-4">
        <div className="text-xl font-bold text-primary">
          VIBOOK
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-foreground"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-card border-r border-border flex flex-col transform transition-transform duration-300",
        // Desktop behavior
        "lg:translate-x-0",
        sidebarHidden && "lg:-translate-x-full",
        // Mobile behavior
        "lg:top-0",
        mobileMenuOpen ? "translate-x-0 top-16" : "-translate-x-full lg:translate-x-0 top-16 lg:top-0"
      )}>
        <div className="hidden lg:flex h-16 items-center px-6 justify-between">
          <div className="text-xl font-bold text-primary">
            VIBOOK
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