import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLeads, getSections, getSellers } from '@/lib/supabase-leads';
import { useToast } from '@/hooks/use-toast';

export interface ReportsMetrics {
  // Métricas generales
  totalLeads: number;
  totalConversations: number;
  totalRevenue: number;
  averageBudget: number;
  
  // Conversión
  conversionRate: number;
  leadsWon: number;
  leadsLost: number;
  
  // Por sección
  leadsBySection: { [key: string]: number };
  budgetBySection: { [key: string]: number };
  
  // Destinos populares
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  
  // Datos por canal
  channelMetrics: Array<{
    channel: string;
    conversations: number;
    leads: number;
    conversion: number;
  }>;
  
  // Tendencias temporales
  leadsOverTime: Array<{ date: string; count: number; revenue: number }>;
  
  // Tipos de viaje
  tripTypes: Array<{ type: string; count: number; percentage: number }>;
}

export function useReports(dateFrom?: Date, dateTo?: Date) {
  const [metrics, setMetrics] = useState<ReportsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const calculateMetrics = async () => {
    setLoading(true);
    try {
      console.log('🔄 Calculating reports metrics...');
      
      // Obtener datos principales
      const [leads, sections, conversations] = await Promise.all([
        getLeads(),
        getSections('00000000-0000-0000-0000-000000000002'), // DUMMY_AGENCY_ID
        getConversations()
      ]);

      console.log('📊 Raw data:', { leads: leads.length, sections: sections.length, conversations: conversations.length });

      // Filtrar por fechas si se especifican
      let filteredLeads = leads;
      if (dateFrom && dateTo) {
        filteredLeads = leads.filter(lead => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= dateFrom && leadDate <= dateTo;
        });
      }

      // === MÉTRICAS BÁSICAS ===
      const totalLeads = filteredLeads.length;
      const totalConversations = conversations.length;
      
      // Calcular ingresos totales sumando presupuestos de la sección "Ganados"
      const ganadosSection = sections.find(section => section.name === 'Ganados');
      const totalRevenue = ganadosSection 
        ? filteredLeads
            .filter(lead => lead.section_id === ganadosSection.id)
            .reduce((sum, lead) => sum + (lead.budget || 0), 0)
        : 0;
        
      const averageBudget = filteredLeads.length > 0 
        ? filteredLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0) / filteredLeads.length 
        : 0;

      // === CONVERSIÓN ===
      const leadsWon = filteredLeads.filter(lead => lead.status === 'won').length;
      const leadsLost = filteredLeads.filter(lead => lead.status === 'lost').length;
      const conversionRate = totalLeads > 0 ? (leadsWon / totalLeads) * 100 : 0;

      // === POR SECCIÓN ===
      const leadsBySection: { [key: string]: number } = {};
      const budgetBySection: { [key: string]: number } = {};
      
      sections.forEach(section => {
        const sectionLeads = filteredLeads.filter(lead => lead.section_id === section.id);
        leadsBySection[section.name] = sectionLeads.length;
        budgetBySection[section.name] = sectionLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
      });

      // === DESTINOS POPULARES ===
      const destinationStats: { [key: string]: { count: number; revenue: number } } = {};
      filteredLeads.forEach(lead => {
        const dest = lead.trip.city || 'Sin destino';
        if (!destinationStats[dest]) {
          destinationStats[dest] = { count: 0, revenue: 0 };
        }
        destinationStats[dest].count++;
        if (lead.status === 'won') {
          destinationStats[dest].revenue += lead.budget || 0;
        }
      });

      const topDestinations = Object.entries(destinationStats)
        .map(([destination, stats]) => ({
          destination,
          count: stats.count,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // === MÉTRICAS POR CANAL ===
      const channelStats: { [key: string]: { conversations: number; leads: number } } = {};
      
      conversations.forEach(conv => {
        const channel = conv.channel === 'wa' ? 'WhatsApp' : 'Web';
        if (!channelStats[channel]) {
          channelStats[channel] = { conversations: 0, leads: 0 };
        }
        channelStats[channel].conversations++;
      });

      filteredLeads.forEach(lead => {
        if (lead.conversation_id) {
          const conv = conversations.find(c => c.id === lead.conversation_id);
          if (conv) {
            const channel = conv.channel === 'wa' ? 'WhatsApp' : 'Web';
            if (channelStats[channel]) {
              channelStats[channel].leads++;
            }
          }
        }
      });

      const channelMetrics = Object.entries(channelStats).map(([channel, stats]) => ({
        channel,
        conversations: stats.conversations,
        leads: stats.leads,
        conversion: stats.conversations > 0 ? (stats.leads / stats.conversations) * 100 : 0
      }));

      // === LEADS A LO LARGO DEL TIEMPO ===
      const timeStats: { [key: string]: { count: number; revenue: number } } = {};
      filteredLeads.forEach(lead => {
        const date = new Date(lead.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
        if (!timeStats[date]) {
          timeStats[date] = { count: 0, revenue: 0 };
        }
        timeStats[date].count++;
        if (lead.status === 'won') {
          timeStats[date].revenue += lead.budget || 0;
        }
      });

      const leadsOverTime = Object.entries(timeStats)
        .map(([date, stats]) => ({
          date,
          count: stats.count,
          revenue: stats.revenue
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Últimos 30 días

      // === TIPOS DE VIAJE ===
      const tripTypeStats: { [key: string]: number } = {};
      filteredLeads.forEach(lead => {
        const type = lead.trip.type || 'package';
        tripTypeStats[type] = (tripTypeStats[type] || 0) + 1;
      });

      const tripTypes = Object.entries(tripTypeStats).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
      }));

      const calculatedMetrics: ReportsMetrics = {
        totalLeads,
        totalConversations,
        totalRevenue,
        averageBudget,
        conversionRate,
        leadsWon,
        leadsLost,
        leadsBySection,
        budgetBySection,
        topDestinations,
        channelMetrics,
        leadsOverTime,
        tripTypes
      };

      console.log('✅ Calculated metrics:', calculatedMetrics);
      setMetrics(calculatedMetrics);

    } catch (error) {
      console.error('❌ Error calculating metrics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los reportes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para obtener conversaciones
  const getConversations = async () => {
    try {
      const mockAgencyId = '00000000-0000-0000-0000-000000000001';
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agency_id', mockAgencyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  };

  useEffect(() => {
    calculateMetrics();
  }, [dateFrom, dateTo]);

  return {
    metrics,
    loading,
    refresh: calculateMetrics
  };
}