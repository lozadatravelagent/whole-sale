import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LanguageSelector } from '@/components/LanguageSelector';
import { OrbitMark, MeridianMono } from '@/components/meridian';
import { getAvatarMenuItems } from './unifiedLayoutMenu';

interface UnifiedLayoutProps {
  children: React.ReactNode;
  /**
   * Optional secondary panel rendered to the right of `children` on desktop
   * (lg+). On mobile/tablet the panel is hidden and `children` takes the full
   * width.
   */
  rightPanel?: React.ReactNode;
  rightPanelWidth?: React.CSSProperties['width'];
  headerContext?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}

const HEADER_HEIGHT = 56;
// Matches the legacy CompanionLayout right column (lg:w-80 = 320px). Avoids
// squeezing ChatInterface in the lg viewport (1024px) where the split first
// kicks in: with a 288px sidebar (md:w-72) the chat keeps ~416px instead of
// shrinking to ~376px under a 360px panel.
const RIGHT_PANEL_WIDTH = 320;

export default function UnifiedLayout({
  children,
  rightPanel,
  rightPanelWidth = RIGHT_PANEL_WIDTH,
  headerContext,
  headerActions,
  className,
}: UnifiedLayoutProps) {
  const { t } = useTranslation('common');
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
        title: t('logoutToast.title'),
        description: msg || t('logoutToast.description'),
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
        className="grid grid-cols-[minmax(128px,1fr)_minmax(0,760px)_minmax(128px,1fr)] items-center gap-3 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          <Link to="/emilia/chat" aria-label={t('nav.home')} className="inline-flex items-center gap-2 transition-opacity duration-300 ease-out-expo hover:opacity-80">
            <OrbitMark size={36} />
          </Link>
        </div>

        {headerContext ? (
          <div className="hidden min-w-0 justify-self-center md:block">
            {headerContext}
          </div>
        ) : (
          <div />
        )}

        <div className="flex min-w-0 items-center gap-2 justify-self-end">
          {headerActions && (
            <div className="hidden items-center gap-2 md:flex">
              {headerActions}
            </div>
          )}
          <LanguageSelector showLabel={false} />
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full p-0"
                aria-label={t('userMenu')}
              >
                <span className="text-xs font-semibold">{initials}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="meridian-glass-strong w-56 rounded-2xl border-border/40 bg-transparent p-2 shadow-none"
            >
              <div className="flex flex-col gap-1">
                {user?.email && (
                  <div className="border-b border-border/40 pb-2 px-2 pt-1">
                    <MeridianMono size="sm" className="block truncate text-foreground">
                      {user.email}
                    </MeridianMono>
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
                        'rounded-xl px-3 py-2 font-utility text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-300 ease-out-expo',
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground hover:bg-foreground/10'
                      )}
                    >
                      {t(`nav.${item.labelKey}`)}
                    </Link>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start rounded-xl font-utility text-[11px] font-bold uppercase tracking-[0.12em] text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('logout')}
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
              style={{ width: rightPanelWidth }}
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
