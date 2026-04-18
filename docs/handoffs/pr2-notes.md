# PR 2 — Notas para C11 + TODOs pendientes pre-merge

Notas operativas para que se incluyan al cerrar PR 2 en C11, más una lista
de verificaciones manuales que tienen que pasar antes del merge final a main.

## 1. Lista de dead code para PR 4

Agregar a `docs/B2C_STATUS.md` (sección "dead code pendiente para PR 4")
durante C11:

- `consumerLoginSchema` en `src/features/companion/utils/consumerAuthSchema.ts`
  (post-borrado de ConsumerLogin en C5b ya no tiene callers productivos; el
  test `consumerAuthSchema.test.ts` sigue ejerciéndolo).
- `ConsumerLoginFormData` en el mismo archivo (alias de tipo derivado del
  schema; mismo estado).
- `fetchUserAccountType` en
  `src/features/companion/services/consumerAuthService.ts` (ya marcada
  `@deprecated` en C5b).

## 2. Entrada nueva en TECH_DEBT.md como D17

La última entrada existente en `TECH_DEBT.md` al cierre de PR 2 es D16. La
entrada nueva va como D17 (secuencial, sin reservar slots).

Texto a agregar al final del archivo durante C11:

```
## D17 — UnifiedLayout sin i18n para avatar menu y logout 🟡 UX

UnifiedLayout (introducido en PR 2 / C6) renderiza copy literal en español
para los items del avatar menu, el aria-label del trigger y los toasts de
logout. CompanionLayout — al que reemplaza — usaba useTranslation('auth') y
exponía el copy a través de los archivos i18n.

Regresión menor de Fase 1.2 (i18n para Emilia B2C, PR #72). Un consumer con
preferredLanguage distinto a 'es' verá el menú del avatar y el botón de
"Cerrar sesión" en español hasta que se porte UnifiedLayout a i18n.

No bloqueante para el lanzamiento. Fix recomendado: commit independiente
post-PR-2 o parte del polish pre-launch. Pasos:

1. Importar useTranslation en UnifiedLayout.tsx.
2. Mover los strings literales (Settings, Users, Agencies, Tenants, Dashboard,
   Profile, "Cerrar sesión", "Menú de usuario", toast titles) a las claves
   correspondientes en src/i18n/locales/{es,en,pt}/auth.json y common.json.
3. Decidir si los labels del menu (Settings, Users, etc.) viven en common o
   en un namespace nuevo "navigation".

**Origen**: detectado durante PR 2, C6.
```

## 3. TODO antes de final PR review (visual smoke)

Resolver antes de pedir review/merge de PR 2 a `main`:

- **Chat estrecho en viewport 1024px (lg mínimo).** El cálculo teórico con
  rightPanel 320px y sidebar md:w-72 (288px) deja 416px para el ChatInterface
  en viewport 1024px. Análisis de código (Verif 1 post-C7) lo dio como
  funcional pero apretado en el límite. **Falta confirmación visual real**:
  abrir el dev server, loguearse como consumer, cargar una conversación con
  itinerario que tenga 3+ destinos y segments completos, achicar el viewport
  a exactamente 1024px y verificar:
    1. Tipografía del chat se lee sin desbordes ni reflows raros.
    2. Sidebar de conversaciones (`md:w-72`) no comprime al chat al punto de
       romper input ni botones de acciones.
    3. El input de mensajes mantiene espacio para placeholder + íconos.
    4. ItineraryPanel a 320px renderiza los Blocks y el botón "¿Querés
       ajustar algo?" sin truncations no deseadas.

  Si algo falla a 1024px, opciones de mitigación: subir el breakpoint del
  split (`lg:` → `xl:`) o reducir el ancho del sidebar consumer
  (`md:w-72` → `md:w-64`). Cualquiera de las dos es un commit chico.

  Si pasa visualmente: anotar OK acá y proceder al merge.

- **Verificación de logout robusto en práctica.** Loguearse, hacer logout
  desde el avatar menu, confirmar que `localStorage` queda limpio (DevTools
  → Application → Local Storage, sin claves `sb-*`/`supabase`) y que el
  redirect aterrizó en `/emilia` (landing) vía el RootRedirect de C1.
