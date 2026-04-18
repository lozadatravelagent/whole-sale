import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LanguageSelector } from '@/components/LanguageSelector';
import { getAvatarMenuItems } from './unifiedLayoutMenu';

interface UnifiedLayoutProps {
  children: React.ReactNode;
  /**
   * Optional secondary panel rendered to the right of `children` on desktop
   * (lg+). On mobile/tablet the panel is hidden and `children` takes the full
   * width.
   */
  rightPanel?: React.ReactNode;
  className?: string;
}

const HEADER_HEIGHT = 56;
// Matches the legacy CompanionLayout right column (lg:w-80 = 320px). Avoids
// squeezing ChatInterface in the lg viewport (1024px) where the split first
// kicks in: with a 288px sidebar (md:w-72) the chat keeps ~416px instead of
// shrinking to ~376px under a 360px panel.
const RIGHT_PANEL_WIDTH = 320;

export default function UnifiedLayout({ children, rightPanel, className }: UnifiedLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const menuItems = getAvatarMenuItems(user?.role);

  // Robust logout copied from MainLayout: clears Supabase keys in localStorage,
  // tolerates 401/403/Auth-session-missing errors and falls through to a hard
  // redirect to "/" so the conditional root redirect lands the user on the
  // public Emilia landing.
  const handleLogout = async () => {
    const cleanupSupabaseStorage = () => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* swallow — best-effort cleanup */
      }
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace('/');
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      cleanupSupabaseStorage();
      window.location.replace('/');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error ?? '');
      const isAuthMissing =
        msg.includes('Auth session missing') ||
        msg.includes('401') ||
        msg.includes('403');
      if (isAuthMissing) {
        cleanupSupabaseStorage();
        window.location.replace('/');
        return;
      }
      console.error('Error during logout:', error);
      toast({
        title: 'Error al cerrar sesión',
        description: msg || 'Hubo un problema cerrando la sesión.',
        variant: 'destructive',
      });
    }
  };

  const initials =
    (user?.email?.[0]?.toUpperCase() || 'E') +
    (user?.email?.split('@')[0]?.[1]?.toUpperCase() || '');

  return (
    <div className={cn('flex min-h-screen flex-col bg-background', className)}>
      <header
        className="flex items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Emilia</span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector showLabel={false} />
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full p-0"
                aria-label="Menú de usuario"
              >
                <span className="text-xs font-semibold">{initials}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="flex flex-col gap-1">
                {user?.email && (
                  <div className="border-b border-border pb-2">
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                )}
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setUserMenuOpen(false)}
                      className={cn(
                        'rounded-md px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-foreground text-background'
                          : 'text-foreground/80 hover:bg-muted'
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main
        className={cn(rightPanel ? 'overflow-hidden' : 'overflow-y-auto')}
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
      >
        {rightPanel ? (
          <div className="flex h-full">
            <div className="flex-1 min-w-0 overflow-hidden h-full">{children}</div>
            <aside
              className="hidden lg:block flex-shrink-0 border-l border-border overflow-hidden"
              style={{ width: RIGHT_PANEL_WIDTH }}
            >
              {rightPanel}
            </aside>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
