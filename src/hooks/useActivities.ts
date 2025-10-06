import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Activity {
  id: string;
  created_at: string;
  activity_type: 'lead_created' | 'lead_won' | 'lead_lost' | 'quote_sent' | 'message_sent' | 'status_changed' | 'note_added';
  description: string;
  lead_id: string | null;
  user_id: string | null;
  agency_id: string;
  tenant_id: string;
  metadata: any;
}

export function useActivities(limit: number = 5) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      // Don't show toast for table not existing (migration not run yet)
      if (error.code !== '42P01') {
        toast({
          title: "Error",
          description: "No se pudieron cargar las actividades",
          variant: "destructive",
        });
      }
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('activities_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities'
      }, () => {
        fetchActivities();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [limit]);

  return {
    activities,
    loading,
    refresh: fetchActivities
  };
}
