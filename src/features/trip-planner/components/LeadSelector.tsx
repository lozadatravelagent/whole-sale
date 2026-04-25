import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LeadSelectorProps {
  value: string | null;
  leadName?: string | null;
  onSelect: (leadId: string, leadName: string) => void;
  onClear: () => void;
}

export default function LeadSelector({ value, leadName, onSelect, onClear }: LeadSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  const { data: leads } = useQuery({
    queryKey: ['leads-search', user?.agency_id, search],
    queryFn: async () => {
      if (!user?.agency_id || search.length < 2) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, contact')
        .eq('agency_id', user.agency_id)
        .limit(8);

      if (!data) return [];

      // Filter client-side since contact is JSONB
      const lower = search.toLowerCase();
      return data.filter((lead: any) => {
        const contact = lead.contact as { name?: string; email?: string; phone?: string } | null;
        return (
          contact?.name?.toLowerCase().includes(lower) ||
          contact?.email?.toLowerCase().includes(lower) ||
          contact?.phone?.includes(search)
        );
      }).map((lead: any) => ({
        id: lead.id,
        name: (lead.contact as any)?.name ?? 'Sin nombre',
        email: (lead.contact as any)?.email ?? '',
      }));
    },
    enabled: !!user?.agency_id && search.length >= 2,
  });

  if (value && leadName) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Lead:</span>
        <span className="font-medium">{leadName}</span>
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          👤 Vincular lead
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
          autoFocus
        />
        {leads && leads.length === 0 && search.length >= 2 && (
          <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
        )}
        {leads?.map(lead => (
          <button
            key={lead.id}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs flex flex-col"
            onClick={() => {
              onSelect(lead.id, lead.name);
              setOpen(false);
              setSearch('');
            }}
          >
            <span className="font-medium">{lead.name}</span>
            {lead.email && <span className="text-muted-foreground">{lead.email}</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
