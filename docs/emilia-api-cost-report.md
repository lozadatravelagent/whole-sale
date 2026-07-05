Emilia API as a Service — Informe de costos por búsqueda
========================================================

Fecha: 2026-06-09  
Alcance: endpoints públicos /v1/emilia/turn y /v1/search (API Gateway Fastify → Edge Functions Supabase).  
Fuentes: medición directa de tokens con o200k\base sobre el código productivo (ai-message-parser v26), telemetría real de producción (llmrequestlogs, últimos 60 días, 825 requests), precios OpenAI vigentes a junio 2026.

  

1\. Resumen ejecutivo
---------------------

Métrica

Valor

Costo LLM real por request (hoy, gpt-4.1)

USD 0,0382 (promedio producción)

Costo por búsqueda completa (hasta devolver vuelos/hoteles)

USD 0,046 (1,2 turnos promedio medidos)

10.000 búsquedas completas

USD 458

Mismo volumen con la optimización pendiente (gpt-4.1-mini)

USD 92 (5× menos)

Driver del costo

System prompt de 32.223 tokens (90%+ del input por llamada)

Cada turno hace exactamente 1 llamada LLM (el parser con tool loop). El router, las respuestas al usuario y la ejecución de búsquedas (Starling/EUROVIPS) son determinísticos y no generan costo por token. Los "prompts sugeridos" / chips se generan sin LLM (costo $0).

  

2\. Anatomía del costo por request
----------------------------------

 Flujo punta a punta

    Cliente → Gateway /v1/emilia/turn   (auth, rate limit, idempotencia — sin LLM)
            → Edge Fn emilia-turn        (estado, persistencia, router — sin LLM)
            → Edge Fn ai-message-parser  (ÚNICA llamada LLM: tool loop gpt-4.1, cap 3 iteraciones)
            → Router QUOTE/COLLECT       (determinístico, <1 ms)
            → executeSearch              (Starling vuelos / EUROVIPS hoteles — por contrato)
            → Respuesta                  (templates determinísticos)
    

 Composición del input por llamada LLM (medido)

Componente

Tokens

Cacheable

System prompt estático

32.223

✅

Schemas de las 8 tools

1.984

✅

Bloque dinámico (historial, contexto, memoria)

200–960

❌

responseformat (json\schema)

2.462

parcial

Mensaje del usuario

14–41

❌

Total por request

37.000–38.000

34.200

Los outputs son mínimos (134–260 tokens promedio): el costo está en lo que el modelo lee, no en lo que responde. Por eso una pregunta de clarificación ("¿cuántos pasajeros viajan?") cuesta casi lo mismo que una cotización completa de vuelos + hoteles.

 Telemetría real de producción (60 días, tool loop gpt-4.1, n=153)

Métrica

Valor real

Prompt tokens p50 / promedio / p95

37.231 / 42.267 / 75.804

Completion tokens promedio

260

Cache hit rate

71,4%

Costo promedio por turno

USD 0,0382

Latencia p50 / p95

4,9 s / 9,7 s

Precios aplicados (gpt-4.1): $2,00/M input · $0,50/M input cacheado · $8,00/M output.

 Costo por caso de uso (por request individual)

Caso

Cache frío

Cache caliente

Pregunta de clarificación

$0,075

$0,024

Búsqueda de vuelos

$0,075

$0,024

Vuelos + hoteles + cotización

$0,077

$0,025

Turno con tools (2 iteraciones)

$0,098

$0,047

Peor caso (3 iteraciones + cierre forzado)

$0,144

$0,093

El promedio real de producción ($0,0382) ya pondera frío/caliente y el mix de iteraciones — es el número correcto para proyectar.

  

3\. ¿Qué es "una búsqueda"?
---------------------------

Dos definiciones para cotizar:

   Definición A — 1 búsqueda = 1 request: cada llamada al endpoint (cada turno de conversación o cada /v1/search).
   Definición B — búsqueda realista: la conversación completa desde el primer mensaje hasta devolver resultados de vuelo/hotel, incluyendo turnos de clarificación intermedios.

El ratio real medido en producción (30 días): 372 turnos con resultados vs. 61 clarificaciones + 59 otros → 1,2 turnos por búsqueda completada. Ese ratio viene de agentes de viaje profesionales (mensajes tipo "Cancun julio 2 pax riu iberostar ai"); para integraciones donde escribe el pasajero final conviene presupuestar 2 turnos, y 3 como techo (el sistema corta en 3 clarificaciones consecutivas por diseño).

  

4\. Proyecciones: 500 / 5.000 / 10.000 búsquedas
------------------------------------------------

 4.1 Configuración actual (gpt-4.1 — USD 0,0382/request)

Volumen

A: 1 request

B: 1,2 turnos (medido)

B: 2 turnos (B2C)

B: 3 turnos (techo)

500 búsquedas

$19

$23

$38

$57

5.000 búsquedas

$191

$229

$382

$573

10.000 búsquedas

$382

$458

$764

$1.146

 4.2 Escenario optimizado (CTXTOOLLOOPMODEL=gpt-4.1-mini — USD 0,0077/request)

Pendiente de validar paridad (DEBT-7, docs/architecture/tool-catalog.md). El histórico de producción ya corrió con mini (569 requests exitosos a $0,0048/turno con el prompt anterior), lo que sugiere viabilidad.

Volumen

A: 1 request

B: 1,2 turnos

B: 2 turnos

B: 3 turnos

500 búsquedas

$3,80

$4,60

$7,70

$11,50

5.000 búsquedas

$38

$46

$77

$115

10.000 búsquedas

$77

$92

$153

$230

 4.3 Sensibilidad al cache

El hit rate medido (71,4%) corresponde a tráfico bajo (2,5 turnos/día). A volumen de API el prefijo de 34k tokens se mantiene caliente casi siempre: con 90% de cache el turno baja de $0,0382 a $0,0296 (−22%) sin tocar nada. El costo unitario baja con la escala.

 4.4 Costos no-LLM

Concepto

Por turno

Por 10.000 búsquedas (12.000 turnos)

Edge Functions (2 invocaciones)

$0,000004

$0,05

Upstash Redis (rate limit, idempotencia, cache)

$0,00001

$0,12

Postgres (≈12 queries/turno)

dentro del compute fijo Supabase

—

Railway (gateway)

fijo mensual ($5–20)

—

Starling / EUROVIPS

según contrato

a relevar (vigilar look-to-book de vuelos)

La infraestructura marginal es despreciable (<$0,20 por cada 1.000 búsquedas). La única incógnita material es el contrato con proveedores de inventario.

  

5\. Implicancias para pricing
-----------------------------

Con costo real de $0,046 por búsqueda completa (y $0,009 optimizado):

Precio de venta por búsqueda

Margen bruto hoy

Margen optimizado

$0,10

54%

91%

$0,25

82%

96%

$0,50

91%

98%

Ejemplo: un cliente con 10.000 búsquedas/mes a $0,25 = $2.500 de revenue contra $458 de costo LLM (hoy) o $92 (optimizado).

Palancas de margen, por impacto:

1.  Bajar el modelo del loop a gpt-4.1-mini (÷5 del costo). El switch histórico inverso (mini→4.1) multiplicó el costo 8×.
2.  Podar el system prompt: son 32.2k tokens reales (la documentación interna decía 15k; creció al doble). Volver a 15k ahorraría 41% del costo por turno con el modelo actual.
3.  Volumen: más tráfico → mejor cache hit → menor costo unitario.

Infraestructura de facturación ya disponible: apiusageevents (request por api\key/tenant/endpoint, con cached y statuscode) + llmrequestlogs.estimatedcostusd permiten reconciliar costo real vs. facturado por cliente desde el día uno. Nota: el fix de pricing.ts del 2026-06-09 (normalización de ids de modelo con fecha + precio de gpt-4.1-mini) requiere redeploy de ai-message-parser y travel-itinerary para que los logs nuevos registren costo correcto.

  

6\. Supuestos y límites del análisis
------------------------------------

   Precios OpenAI verificados a junio 2026; el Batch API (−50%) no aplica a este flujo interactivo.
   La ruta PLAN (itinerarios con travel-itinerary) está deshabilitada en la API pública (apiquoteonlyplannerdisabled): el caso caro del planner no existe en este producto.
   Consolidación de memoria (gpt-4.1-mini, cada 20 turnos, background): $0,00007/turno amortizado — incluido por completitud, no material.
   El ratio 1,2 turnos/búsqueda proviene del CRM interno; medir el ratio real de cada integración con apiusageevents durante el piloto y recalibrar.