import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLeads, getSections, getSellers } from '@/lib/supabase-leads';
import { useToast } from '@/hooks/use-toast';
import { useAuthUser } from './useAuthUser';
import type {
  TenantWithMetrics,
  AgencyPerformance,
  SellerPerformance,
  SellerPersonalMetrics
} from '@/types';

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

  // ✅ NEW: Métricas por rol
  tenantsPerformance?: TenantWithMetrics[]; // For OWNER
  agenciesPerformance?: AgencyPerformance[]; // For OWNER/SUPERADMIN
  teamPerformance?: SellerPerformance[]; // For ADMIN
  personalMetrics?: SellerPersonalMetrics; // For SELLER
}

export function useReports(dateFrom?: Date, dateTo?: Date) {
  const [metrics, setMetrics] = useState<ReportsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuthUser();

  const calculateMetrics = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 [REPORTS] Calculating metrics for role:', user.role);

      // ✅ FILTRAR DATOS POR ROL
      let leads, sections, conversations;

      if (isOwner) {
        // OWNER: Ver TODOS los tenants
        const { data: allLeads } = await supabase
          .from('leads')
          .select('*, agencies(name, tenant_id, tenants(name))');
        leads = allLeads || [];

        const { data: allConversations } = await supabase
          .from('conversations')
          .select('*');
        conversations = allConversations || [];

        // Sections de todas las agencias (para análisis)
        const { data: allSections } = await supabase
          .from('sections')
          .select('*');
        sections = allSections || [];

      } else if (isSuperAdmin) {
        // SUPERADMIN: Ver su tenant completo
        const { data: tenantLeads } = await supabase
          .from('leads')
          .select('*, agencies(name)')
          .eq('tenant_id', user.tenant_id!);
        leads = tenantLeads || [];

        const { data: tenantConversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('tenant_id', user.tenant_id!);
        conversations = tenantConversations || [];

        const { data: tenantSections } = await supabase
          .from('sections')
          .select('*, agencies!inner(tenant_id)')
          .eq('agencies.tenant_id', user.tenant_id!);
        sections = tenantSections || [];

      } else if (isAdmin) {
        // ADMIN: Ver solo su agencia
        leads = await getLeads(); // Ya filtra por agency_id en RLS
        conversations = await getConversations(); // Ya filtra por agency_id
        sections = await getSections(user.agency_id!);

      } else if (isSeller) {
        // SELLER: Ver solo sus leads asignados
        const { data: myLeads } = await supabase
          .from('leads')
          .select('*')
          .eq('assigned_user_id', user.id);
        leads = myLeads || [];

        // Conversaciones de sus leads
        const conversationIds = leads
          .map(l => l.conversation_id)
          .filter(Boolean) as string[];

        if (conversationIds.length > 0) {
          const { data: myConversations } = await supabase
            .from('conversations')
            .select('*')
            .in('id', conversationIds);
          conversations = myConversations || [];
        } else {
          conversations = [];
        }

        sections = await getSections(user.agency_id!);
      } else {
        leads = [];
        conversations = [];
        sections = [];
      }

      console.log('📊 [REPORTS] Filtered data:', {
        leads: leads.length,
        sections: sections.length,
        conversations: conversations.length,
        role: user.role
      });

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

      // ✅ === MÉTRICAS ESPECÍFICAS POR ROL ===
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

      // OWNER: Agregar comparativa de tenants
      if (isOwner) {
        // TODO: Implementar TenantWithMetrics cuando haya datos reales
        calculatedMetrics.tenantsPerformance = [];

        // Calcular performance por agencia (cross-tenant)
        const { data: agencies } = await supabase
          .from('agencies')
          .select('id, name, tenant_id, tenants(name)');

        if (agencies) {
          calculatedMetrics.agenciesPerformance = await Promise.all(
            agencies.map(async (agency: any) => {
              const agencyLeads = leads.filter((l: any) => l.agency_id === agency.id);
              const wonLeads = agencyLeads.filter((l: any) => l.status === 'won');

              return {
                agency_id: agency.id,
                agency_name: agency.name,
                tenant_id: agency.tenant_id,
                tenant_name: agency.tenants?.name,
                sellers_count: 0, // TODO: Count sellers
                leads_count: agencyLeads.length,
                revenue: wonLeads.reduce((sum: number, l: any) => sum + (l.budget || 0), 0),
                conversion_rate: agencyLeads.length > 0 ? (wonLeads.length / agencyLeads.length) * 100 : 0,
                active_conversations: conversations.filter((c: any) => c.agency_id === agency.id && c.state === 'active').length
              };
            })
          );
        }
      }

      // SUPERADMIN: Agregar performance de agencias de su tenant
      if (isSuperAdmin) {
        const { data: agencies } = await supabase
          .from('agencies')
          .select('id, name')
          .eq('tenant_id', user.tenant_id!);

        if (agencies) {
          calculatedMetrics.agenciesPerformance = await Promise.all(
            agencies.map(async (agency: any) => {
              const agencyLeads = leads.filter((l: any) => l.agency_id === agency.id);
              const wonLeads = agencyLeads.filter((l: any) => l.status === 'won');

              return {
                agency_id: agency.id,
                agency_name: agency.name,
                sellers_count: 0, // TODO: Count sellers
                leads_count: agencyLeads.length,
                revenue: wonLeads.reduce((sum: number, l: any) => sum + (l.budget || 0), 0),
                conversion_rate: agencyLeads.length > 0 ? (wonLeads.length / agencyLeads.length) * 100 : 0,
                active_conversations: conversations.filter((c: any) => c.agency_id === agency.id && c.state === 'active').length
              };
            })
          );
        }
      }

      // ADMIN: Agregar performance de su equipo (sellers)
      if (isAdmin) {
        const { data: sellers } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('agency_id', user.agency_id!)
          .eq('role', 'SELLER');

        if (sellers) {
          calculatedMetrics.teamPerformance = sellers.map((seller: any) => {
            const sellerLeads = leads.filter((l: any) => l.assigned_user_id === seller.id);
            const wonLeads = sellerLeads.filter((l: any) => l.status === 'won');
            const lostLeads = sellerLeads.filter((l: any) => l.status === 'lost');
            const revenue = wonLeads.reduce((sum: number, l: any) => sum + (l.budget || 0), 0);

            return {
              seller_id: seller.id,
              seller_name: seller.name || seller.email,
              agency_id: user.agency_id!,
              leads_count: sellerLeads.length,
              won_count: wonLeads.length,
              lost_count: lostLeads.length,
              revenue,
              conversion_rate: sellerLeads.length > 0 ? (wonLeads.length / sellerLeads.length) * 100 : 0,
              avg_budget: wonLeads.length > 0 ? revenue / wonLeads.length : 0
            };
          });
        }
      }

      // SELLER: Agregar métricas personales
      if (isSeller) {
        const myWon = filteredLeads.filter(l => l.status === 'won');
        const myRevenue = myWon.reduce((sum, l) => sum + (l.budget || 0), 0);

        // Leads por sección (personal)
        const myLeadsBySection: { [key: string]: number } = {};
        sections.forEach(section => {
          const count = filteredLeads.filter(l => l.section_id === section.id).length;
          if (count > 0) {
            myLeadsBySection[section.name] = count;
          }
        });

        // Próximos vencimientos
        const today = new Date().toISOString().split('T')[0];
        const upcomingDeadlines = filteredLeads
          .filter(l => l.due_date && l.due_date >= today && l.status !== 'won' && l.status !== 'lost')
          .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
          .slice(0, 5)
          .map(l => ({
            lead_id: l.id,
            contact_name: l.contact.name,
            destination: l.trip.city || 'Sin destino',
            due_date: l.due_date!
          }));

        calculatedMetrics.personalMetrics = {
          my_leads: filteredLeads.length,
          my_won: myWon.length,
          my_revenue: myRevenue,
          my_conversion_rate: filteredLeads.length > 0 ? (myWon.length / filteredLeads.length) * 100 : 0,
          my_leads_by_section: myLeadsBySection,
          upcoming_deadlines: upcomingDeadlines,
          monthly_goal: 100000, // TODO: Get from user settings
          monthly_progress: (myRevenue / 100000) * 100
        };
      }

      console.log('✅ [REPORTS] Calculated metrics:', calculatedMetrics);
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