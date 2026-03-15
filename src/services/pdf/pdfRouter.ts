import { supabase } from '@/integrations/supabase/client';

export async function getPdfProvider(agencyId?: string): Promise<'pdfmonkey' | 'custom'> {
  if (!agencyId) return 'custom';

  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('pdf_provider')
      .eq('id', agencyId)
      .single();

    if (error || !data) {
      console.warn('[PDF Router] Could not fetch pdf_provider, defaulting to custom:', error?.message);
      return 'custom';
    }

    const provider = (data as any).pdf_provider;
    if (provider === 'custom' || provider === 'pdfmonkey') {
      return provider;
    }

    return 'custom';
  } catch (err) {
    console.error('[PDF Router] Error:', err);
    return 'custom';
  }
}
