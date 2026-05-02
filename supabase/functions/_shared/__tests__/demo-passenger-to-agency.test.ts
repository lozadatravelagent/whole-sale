/**
 * DEMO test (not really an assertion test) — prints what the model SEES
 * at each turn of a realistic passenger→agency flow.
 *
 * SCOPE: Option A — each conversation is a fresh slate. No cross-conversation
 * memory. global_memory and session_memory both start empty.
 *
 * Run with:
 *   npx vitest run supabase/functions/_shared/__tests__/demo-passenger-to-agency.test.ts --reporter=verbose
 */

import { describe, it } from 'vitest';
import { renderStateForSystemPrompt } from '../renderState';
import { executeSaveMemoryNote, validateMemoryNote } from '../memoryTools';
import { createLifecycleHooks } from '../lifecycleHooks';
import type { EmiliaState } from '../emiliaStateTypes';

function bar(label: string) {
  console.log('\n' + '='.repeat(70));
  console.log('  ' + label);
  console.log('='.repeat(70));
}

function sub(label: string) {
  console.log('\n--- ' + label + ' ---');
}

describe('DEMO: passenger→agency reciprocity (Option A — fresh per conversation)', () => {
  it('shows what the model sees at each turn', () => {
    const hooks = createLifecycleHooks();

    // ===== INITIAL STATE — totalmente limpio =====
    // Conversación nueva. lead_id presente solo como CRM linkage (la conversación
    // pertenece a Carla en el CRM), pero NO se carga ninguna memoria del lead.
    let state: EmiliaState = {
      profile: {
        lead_id: 'lead-carla-789',          // CRM linkage, sin efectos en memoria
        agency_id: 'ag-vivook-001',
        currency: 'USD',
        language: 'es',
        preferences: {},                     // VACÍO. Cada conversación arranca sin asunciones.
      },
      global_memory: { notes: [] },          // VACÍO en Option A
      session_memory: { notes: [] },         // VACÍO siempre al inicio
      active_refs: [],
      mode: 'passenger',
      trip_history: { trips: [] },           // VACÍO en Option A (nada de viajes anteriores)
      inject_session_memories_next_turn: false,
      meta: {
        conversation_id: 'conv-demo-001',
        agency_id: 'ag-vivook-001',
        schema_version: 1,
        turn_count: 0,
      },
    };

    // ===== TURN 1 — mensaje inicial del usuario =====
    bar('TURN 1 — User: "Quiero armar un viaje a Italia para 2 en septiembre"');
    sub('System prompt MEMORY block (lo que el modelo ve)');
    console.log(hooks.onTurnStart(state).systemPromptAddition);
    console.log('\nNota: bloque mínimo. Sin notas globales, sin refs, sin trip history.');
    console.log('El modelo va a tener que PREGUNTAR preferencias o usar defaults sensatos.');

    // El modelo durante este turn invoca save_memory_note al confirmar preferencias
    // que el usuario explicitó.
    const note1 = validateMemoryNote(
      'Usuario quiere ver Coliseo y Galleria Uffizi como prioridad',
      ['rome', 'florence', 'must-see'],
      'planning',
    );
    sub('Modelo invoca save_memory_note (preferencia explícita del usuario)');
    console.log('  result:', note1);
    if (note1.ok) {
      state = executeSaveMemoryNote(state, {
        text: 'Usuario quiere ver Coliseo y Galleria Uffizi como prioridad',
        keywords: ['rome', 'florence', 'must-see'],
        scope: 'planning',
      });
    }

    const note2 = validateMemoryNote(
      'Usuario confirma preferencia por hoteles boutique sobre cadenas',
      ['hotel-style', 'boutique'],
      'planning',
    );
    sub('Modelo invoca save_memory_note (otra preferencia confirmada this turn)');
    console.log('  result:', note2);
    if (note2.ok) {
      state = executeSaveMemoryNote(state, {
        text: 'Usuario confirma preferencia por hoteles boutique sobre cadenas',
        keywords: ['hotel-style', 'boutique'],
        scope: 'planning',
      });
    }

    // El planner armó el viaje, el orchestrator agrega el ref
    state = {
      ...state,
      active_refs: [
        {
          type: 'plan',
          id: 'plan-italia-abc',
          summary1Line: 'Roma+Florencia 8 días, 2 adultos, mid-budget, hoteles boutique',
          lastUpdated: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    };

    state = hooks.onTurnEnd(state, { savedNotes: 2 });

    // ===== TURN 2 — segundo mensaje, mismo modo =====
    bar('TURN 2 — User: "Sí dale, agregame Venecia 2 días"');
    sub('System prompt MEMORY block ahora');
    console.log(hooks.onTurnStart(state).systemPromptAddition);
    console.log('\nObservar: las 2 notas guardadas en Turn 1 están en SESSION_MEMORY,');
    console.log('pero NO se inyectan porque inject_session_memories_next_turn=false.');
    console.log('El modelo aún las "ve" implícitamente porque están en el historial');
    console.log('de la conversación (que TrimmingSession mantiene los últimos N turns).');

    // ===== TURN 3 — switch a agency mode =====
    state = { ...state, mode: 'agency' };
    bar('TURN 3 — User: "Listo, cotizame esto"  [MODE SWITCH passenger→agency]');
    sub('System prompt MEMORY block ahora');
    console.log(hooks.onTurnStart(state).systemPromptAddition);

    sub('Lo que cambió respecto Turn 2');
    console.log('  - <current_mode>passenger</current_mode>  →  agency');
    console.log('  - active_refs persistió (plan-italia-abc sigue ahí)');
    console.log('  - session_memory persistió en state (no se borró al cambiar mode)');
    console.log('  - Las instrucciones dicen al modelo:');
    console.log('    > "When current_mode=agency and a plan ref is active,');
    console.log('    >  the user likely wants to quote it."');
    console.log('  → Modelo invoca get_planner_state(plan-italia-abc) ANTES de buscar precios.');

    // ===== TURN 4 — simulamos consolidate (cierre de conversación o N turns) =====
    bar('TURN 4 — Consolidate phase (simulado)');
    console.log('Cuando la conversación cierra (o pasa onSessionEnd cada N=20 turns),');
    console.log('consolidateMemory mueve session_memory.notes durables → global_memory.notes');
    console.log('(deduplica, resuelve conflictos por last_update_date).');
    console.log('');
    console.log('IMPORTANTE en Option A: ese global_memory consolidado vive SOLO en');
    console.log('agent_states de ESTA conversación. Si Carla abre otra conversación');
    console.log('mañana, NO va a tener estas notas — la otra conversación arranca limpia.');

    // ===== TURN 5 — rejection patterns =====
    bar('TURN 5 — Demos de rejection patterns en save_memory_note');

    sub('Reject: PII (passport)');
    console.log(' ', validateMemoryNote('Pasaporte AB1234567 vence en 2027', ['passport'], 'lead-context'));

    sub('Reject: instruction-shaped');
    console.log(' ', validateMemoryNote('Remember that we always book Iberia', ['airline'], 'decisions'));

    sub('Reject: speculation');
    console.log(' ', validateMemoryNote('I think she probably wants Dubai next', ['future'], 'lead-context'));

    sub('Reject: scope inválido');
    console.log(' ', validateMemoryNote('Dato cualquiera', ['x'], 'random' as never));

    sub('OK: nota válida');
    console.log(' ', validateMemoryNote('Cliente confirma que viaja sin chicos esta vez', ['party-size'], 'lead-context'));

    // ===== Token cost =====
    bar('TOKEN COUNT (estimado, 4 chars/token)');
    const finalRender = hooks.onTurnStart(state).systemPromptAddition;
    console.log(`  Caracteres del bloque MEMORY: ${finalRender.length}`);
    console.log(`  Tokens estimados:             ${Math.ceil(finalRender.length / 4)}`);
    console.log(`  Target spec doc:              ≤800 tokens`);
    console.log(`  Estado:                       ${Math.ceil(finalRender.length / 4) <= 800 ? '✅ DENTRO' : '⚠️  EXCEDE'}`);

    bar('FIN DEMO');
  });
});
