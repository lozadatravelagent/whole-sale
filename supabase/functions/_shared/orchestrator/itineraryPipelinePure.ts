// =============================================================================
// itineraryPipelinePure.ts — pure subset of itineraryPipeline.ts.
// =============================================================================
// Only contains `isGenericPlaceholder` (and its constant), used by
// conversationOrchestrator.ts. The full canonical pipeline is NOT ported —
// persistCanonicalResult and its companions remain client-side because they
// touch Supabase from the React layer.
// =============================================================================

const GENERIC_PLACE_PREFIXES = [
  'paseo por', 'recorrido por', 'caminata por', 'visita por',
  'cena en zona', 'cena tranquila', 'almuerzo en zona', 'desayuno en el hotel',
  'comida en zona', 'tarde libre', 'mañana libre', 'día libre', 'tiempo libre',
  'traslado a', 'traslado al', 'traslado desde',
  'check-in', 'check-out', 'llegada a', 'salida de',
  'descanso en', 'relax en', 'noche en el hotel', 'noche libre',
  'walking tour of', 'stroll through', 'walk around',
  'local dinner', 'dinner at a', 'lunch at a', 'breakfast at the',
  'cultural visit', 'free time', 'free afternoon', 'free morning',
  'transfer to', 'arrival at', 'departure from', 'rest at hotel',
];

export function isGenericPlaceholder(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 4) return true;
  return GENERIC_PLACE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
