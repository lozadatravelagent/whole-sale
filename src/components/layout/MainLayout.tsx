import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/theme-provider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  House,
  MessageCircle,
  BookUser,
  ShoppingBag,
  TrendingUp,
  SlidersHorizontal,
  ArrowRightFromLine,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Crown,
  Shield,
  CircleUserRound,
  CircleUser,
  UsersRound,
  Landmark,
  Globe
} from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';

interface MainLayoutProps {
  children: React.ReactNode;
  userRole?: 'SUPERADMIN' | 'ADMIN';
  sidebarExtra?: React.ReactNode;
  overlaySidebar?: React.ReactNode;
  overlaySidebarState?: 'open' | 'closing';
  activeNavigationOverride?: string | null;
  onOverlaySidebarClosed?: () => void;
  onChatNavigationClick?: () => void;
  forceRailMode?: boolean;
}

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: House },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'CRM', href: '/crm', icon: BookUser },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
  { name: 'Reports', href: '/reports', icon: TrendingUp },
];

const adminNavigation = [
  { name: 'Settings', href: '/settings', icon: SlidersHorizontal },
  { name: 'Users', href: '/users', icon: UsersRound, roles: ['OWNER', 'SUPERADMIN', 'ADMIN'] },
  { name: 'Agencies', href: '/agencies', icon: Landmark, roles: ['OWNER', 'SUPERADMIN'] },
  { name: 'Tenants', href: '/tenants', icon: Globe, roles: ['OWNER'] },
];

const DESKTOP_SIDEBAR_WIDTH = 272;
const DESKTOP_CHAT_RAIL_WIDTH = 72;
const DESKTOP_CHAT_PANEL_WIDTH = 360;


export default function MainLayout({
  children,
  userRole,
  sidebarExtra,
  overlaySidebar,
  overlaySidebarState = 'open',
  activeNavigationOverride = null,
  onOverlaySidebarClosed,
  onChatNavigationClick,
  forceRailMode = false,
}: MainLayoutProps) {
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const hasSidebarOverlay = Boolean(overlaySidebar);
  const isOverlayClosing = hasSidebarOverlay && overlaySidebarState === 'closing';
  const isRailMode = forceRailMode || (hasSidebarOverlay && !isOverlayClosing);
  const activePathname = activeNavigationOverride || location.pathname;
  const freezeNavigationHighlight = Boolean(activeNavigationOverride);
  const desktopSidebarWidth = isRailMode
    ? DESKTOP_CHAT_RAIL_WIDTH
    : hasSidebarOverlay
      ? DESKTOP_SIDEBAR_WIDTH
      : sidebarHidden
      ? 0
      : DESKTOP_SIDEBAR_WIDTH;
  const desktopContentOffset = isRailMode
    ? hasSidebarOverlay && !isOverlayClosing
      ? DESKTOP_CHAT_RAIL_WIDTH + DESKTOP_CHAT_PANEL_WIDTH
      : DESKTOP_CHAT_RAIL_WIDTH
    : hasSidebarOverlay
      ? DESKTOP_SIDEBAR_WIDTH
      : sidebarHidden
      ? 0
      : DESKTOP_SIDEBAR_WIDTH;
  const layoutVars = {
    '--desktop-sidebar-width': `${desktopSidebarWidth}px`,
    '--desktop-overlay-left': `${DESKTOP_CHAT_RAIL_WIDTH}px`,
    '--desktop-overlay-width': `${DESKTOP_CHAT_PANEL_WIDTH}px`,
    '--desktop-content-offset': `${desktopContentOffset}px`,
  } as React.CSSProperties;
  const desktopTransitionStyle = { transitionDuration: '540ms' } as React.CSSProperties;

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
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

  const navigation = baseNavigation;

  const adminNavItems = adminNavigation.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />;
      case 'SUPERADMIN':
        return <Shield className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
      case 'ADMIN':
        return <CircleUserRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
      case 'SELLER':
        return <CircleUser className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
      default:
        return <CircleUser className="h-3.5 w-3.5" />;
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
    <div className="min-h-screen bg-background" style={layoutVars}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-gradient-card border-b border-border flex items-center justify-between px-4">
        <div>
          <img
            src={theme === 'dark' ? '/vibook-white.png' : '/vibook-black.png'}
            alt="Vibook"
            className="h-6"
          />
        </div>
        <div className="flex items-center gap-2">
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
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-border/70 bg-gradient-card backdrop-blur-xl flex flex-col transition-[width,transform,box-shadow] ease-out",
        "shadow-card",
        "lg:w-[var(--desktop-sidebar-width)]",
        // Mobile behavior (siempre oculto por defecto)
        "-translate-x-full",
        mobileMenuOpen && "translate-x-0",
        "top-16 lg:top-0",
        // Desktop behavior
        isRailMode ? "lg:translate-x-0" : !sidebarHidden ? "lg:translate-x-0" : "lg:-translate-x-full"
      )} style={desktopTransitionStyle}>
        <div className={cn(
          "hidden lg:flex h-20 items-center border-b border-border/60",
          isRailMode ? "justify-center px-0" : "justify-between px-6"
        )}>
          {isRailMode ? (
            <img
              src="/android-chrome-192x192.png"
              alt="Vibook"
              className="h-8 w-8 rounded-lg"
            />
          ) : (
            <>
              <img
                src={theme === 'dark' ? '/vibook-white.png' : '/vibook-black.png'}
                alt="Vibook"
                className="h-9"
              />
              <Button variant="ghost" size="icon" onClick={() => setSidebarHidden(true)} className="rounded-full text-muted-foreground hover:bg-background">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <nav className={cn(
          "flex-1 overflow-y-auto",
          isRailMode ? "px-2 py-4 space-y-3" : "px-4 py-5 space-y-2"
        )}>
          {navigation.map((item) => {
            const isActive = activePathname === item.href;
            const isChatNavButton = item.href === '/chat' && Boolean(onChatNavigationClick);
            const navButton = (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                type="button"
                onClick={isChatNavButton ? onChatNavigationClick : undefined}
                className={cn(
                  "relative overflow-hidden",
                  freezeNavigationHighlight ? "transition-none" : "transition-all duration-300",
                  isRailMode
                    ? "h-11 w-11 gap-0 rounded-2xl justify-center px-0 hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[0_10px_28px_-16px_rgba(15,23,42,0.45)]"
                    : "h-12 w-full justify-start gap-3 rounded-2xl px-4 text-[15px]",
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground/95 hover:text-background"
                    : isRailMode
                      ? "text-foreground/80 hover:bg-foreground/8 hover:text-foreground dark:hover:bg-white/10"
                      : "text-foreground/80 hover:bg-background hover:text-foreground dark:hover:bg-card/85"
                )}
              >
                <item.icon className={cn("shrink-0", isRailMode ? "h-5 w-5" : "h-4 w-4")} />
                <span className={cn(
                  "truncate",
                  freezeNavigationHighlight ? "transition-none" : "transition-[opacity,transform,width] duration-300",
                  isRailMode ? "w-0 -translate-x-2 opacity-0" : "w-auto opacity-100"
                )}>
                  {item.name}
                </span>
              </Button>
            );
            const navItem = isChatNavButton ? (
              navButton
            ) : (
              <Link
                to={item.href}
                state={item.name === 'Chat' ? { from: location.pathname } : undefined}
                className="block"
              >
                {navButton}
              </Link>
            );
            return (
              <div key={item.name} className={cn("block", isRailMode && "flex justify-center")}>
                {isRailMode ? (
                  <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={10}
                        className="rounded-full border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-[0_14px_32px_-18px_rgba(15,23,42,0.45)] backdrop-blur-md dark:bg-card/95"
                      >
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  navItem
                )}
              </div>
            );
          })}
        </nav>

        <div className={cn(
          "mt-auto border-t border-border/60",
          isRailMode ? "px-2 py-3" : "px-4 py-3"
        )}>
          {user && (
            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center w-full rounded-2xl transition-colors",
                  isRailMode
                    ? "justify-center h-11 w-11 mx-auto hover:bg-background dark:hover:bg-card/85"
                    : "gap-3 bg-background/80 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-card/85 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-background dark:hover:bg-card"
                )}>
                  {isRailMode ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">
                      {getRoleIcon(user.role)}
                    </div>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground shrink-0">
                        {getRoleIcon(user.role)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold truncate">{getRoleLabel(user.role)}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" sideOffset={8} className="w-[240px] p-2 z-[70]">
                <nav className="space-y-1">
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setUserMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        activePathname === item.href
                          ? "bg-foreground text-background"
                          : "text-foreground/80 hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </Link>
                  ))}
                </nav>
                <div className="my-2 h-px bg-border/70" />
                <div className="flex items-center gap-2">
                  <ThemeToggle variant="default" className="flex-1 justify-center rounded-xl bg-muted/50 px-3 py-2" showLabel />
                  <LanguageSelector variant="outline" className="rounded-xl" showLabel={false} />
                </div>
                <div className="my-2 h-px bg-border/70" />
                <button
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <ArrowRightFromLine className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {sidebarExtra && (
          <div className="flex-1 overflow-y-auto border-t border-border">
            {sidebarExtra}
          </div>
        )}
      </div>

      {overlaySidebar && (
        <div
          className={cn(
            "hidden lg:flex fixed inset-y-0 left-[var(--desktop-overlay-left)] z-[60] w-[var(--desktop-overlay-width)] transition-[transform,opacity] ease-out",
            isOverlayClosing
              ? "-translate-x-10 opacity-0 pointer-events-none"
              : "translate-x-0 opacity-100 animate-[chat-panel-in_420ms_cubic-bezier(0.22,1,0.36,1)]"
          )}
          style={desktopTransitionStyle}
          onTransitionEnd={(event) => {
            if (
              isOverlayClosing &&
              event.target === event.currentTarget &&
              onOverlaySidebarClosed
            ) {
              onOverlaySidebarClosed();
            }
          }}
        >
          {overlaySidebar}
        </div>
      )}

      {/* Main content */}
      <div className={cn(
        "min-h-screen transition-[padding] ease-out",
        "pt-16 lg:pt-0", // Add top padding on mobile for fixed header
        "lg:pl-[var(--desktop-content-offset)]"
      )} style={desktopTransitionStyle}>
        {!hasSidebarOverlay && sidebarHidden && (
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
