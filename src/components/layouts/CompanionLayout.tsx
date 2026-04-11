import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CompanionLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const HEADER_HEIGHT = 56;

export default function CompanionLayout({ children, className }: CompanionLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login', { replace: true });
    } catch (err) {
      toast({
        title: 'Error al cerrar sesión',
        description: err instanceof Error ? err.message : 'Intentá nuevamente.',
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
            <div className="flex flex-col gap-2">
              {user?.email && (
                <div className="border-b border-border pb-2">
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </header>

      <main
        className="flex-1 overflow-hidden"
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
      >
        {children}
      </main>
    </div>
  );
}
