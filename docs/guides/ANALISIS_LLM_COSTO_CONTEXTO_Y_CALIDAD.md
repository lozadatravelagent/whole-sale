# Analisis de APIs LLM para WholeSale Connect

Fecha del analisis: `2026-04-25`

## Resumen

- Para el negocio actual de `WholeSale Connect` conviene mantener `OpenAI` como proveedor principal.
- La razon no es solo calidad del modelo: el proyecto ya usa `OpenAI` en `ai-message-parser` y `travel-itinerary`, y el mayor ahorro hoy vendra de reducir contexto bruto y separar modelos por tarea, no de cambiar de vendor.
- Dado el escenario definido para este analisis:
  - hasta `50k turnos/mes`,
  - prioridad `balance costo/calidad`,
  - memoria por `cliente/lead`,
  - preferencia por `un proveedor principal`,
  conviene optimizar la arquitectura actual antes de introducir un stack hibrido.
- Hallazgo del repo:
  - `ai-message-parser` hoy envia hasta `20` mensajes de historial al modelo.
  - `travel-itinerary` ya distingue `skeleton | segment | full`.
  - `travel-itinerary` ademas hace un `repair pass`, que hoy tambien consume un modelo relativamente caro.
- Recomendacion por tarea:
  - `ai-message-parser` -> `gpt-5-mini`
  - `travel-itinerary` con `generationMode=skeleton` -> `gpt-5-mini`
  - `travel-itinerary` con `generationMode=full|segment` -> `gpt-4.1`
  - `repair pass` de JSON o formato -> `gpt-5-nano`
  - `conversation summaries` y memoria larga -> `gpt-5-nano`
  - `embeddings` para CRM, PDFs y notas no estructuradas -> `text-embedding-3-small`

## Recomendacion Principal

### Proveedor principal

- Mantener `OpenAI` como stack principal.

### Por que

- Ya existe integracion operativa en el repo.
- Reduce complejidad de testing, observabilidad y fallback.
- Evita inconsistencias de comportamiento entre proveedores en parsing, edicion de itinerarios y salidas JSON.
- Permite optimizar rapido sin agregar otra capa operativa.

### Donde si conviene gastar

- En generacion de itinerarios `full` y `segment`, porque ahi el usuario percibe directamente la calidad.

### Donde no conviene gastar

- Parsing de mensajes.
- Reparacion de JSON o ajuste de formato.
- Resumenes de memoria.
- Recuperacion de contexto largo cuando puede resolverse con memoria estructurada.

## Recomendacion de Modelos por Flujo

### 1. Parser de mensajes

- Modelo recomendado: `gpt-5-mini`
- Uso: clasificacion de intencion, extraccion estructurada, merge con contexto previo, deteccion de `editIntent`.
- Motivo:
  - mejor relacion costo/calidad para tareas estructuradas,
  - contexto amplio,
  - deberia reemplazar bien el `gpt-4.1-mini` actual sin perder robustez.

### 2. Itinerario tipo skeleton

- Modelo recomendado: `gpt-5-mini`
- Uso: estructura base del viaje, distribucion inicial, primer borrador liviano.
- Motivo:
  - este modo no necesita la maxima calidad editorial,
  - sirve para reducir costo cuando el usuario aun no esta en la etapa final del itinerario.

### 3. Itinerario tipo full o segment

- Modelo recomendado: `gpt-4.1`
- Uso: redaccion final, propuestas mas ricas, regeneracion de segmento o dias, mayor densidad editorial.
- Motivo:
  - es donde mas se nota la calidad del modelo,
  - protege la experiencia final del itinerario,
  - evita degradar el valor percibido del producto.

### 4. Repair pass

- Modelo recomendado: `gpt-5-nano`
- Uso: reparar JSON, ajustar formato, corregir pequenas inconsistencias mecanicas.
- Motivo:
  - es una tarea determinista y barata,
  - no tiene sentido pagar `gpt-4.1` para esta capa.

### 5. Resumenes y memoria larga

- Modelo recomendado: `gpt-5-nano`
- Uso: resumir conversacion, compactar memoria por lead, extraer preferencias persistentes.
- Motivo:
  - bajo costo,
  - suficiente para consolidar facts y preferencias.

### 6. Embeddings

- Modelo recomendado: `text-embedding-3-small`
- Uso:
  - notas largas del vendedor,
  - PDFs,
  - observaciones CRM,
  - texto libre historico.
- Motivo:
  - extremadamente barato,
  - adecuado para retrieval semantico de negocio.

## Comparacion de Proveedores

### OpenAI

- Recomendado como proveedor principal.
- Mejor encaje hoy para este proyecto por integracion existente y menor friccion de implementacion.

### Gemini

- `Gemini 2.5 Flash-Lite` es muy competitivo en precio.
- `Gemini 2.5 Pro` ofrece contexto muy amplio.
- No lo recomiendo como proveedor principal en esta etapa porque:
  - agrega complejidad operativa,
  - obliga a testear diferencias en calidad de JSON y comportamiento,
  - fragmenta observabilidad y politicas de fallback.
- Si mas adelante el volumen crece mucho, es el primer candidato para un stack hibrido en tareas economicas.

### Claude

- `Claude Sonnet 4.6` tiene muy buena calidad y contexto amplio.
- No es la mejor relacion costo/beneficio para este flujo actual, especialmente si la mayor parte del ahorro esperado viene de parser, repair y memoria.

## Contexto y Memoria por Usuario

## Principio clave

- No usar la ventana de contexto del modelo como memoria principal del negocio.
- La memoria debe vivir en el sistema y entrar al prompt ya resumida y estructurada.

## Estrategia recomendada

### Memoria corta por conversacion

- Guardar un `conversation_summary` rodante.
- Actualizarlo cada `3-5` turnos o cuando cambian datos clave:
  - destino,
  - fechas,
  - viajeros,
  - presupuesto,
  - ritmo del viaje,
  - restricciones.

### Memoria larga por cliente o lead

- Guardar un `lead_profile_memory` persistente y estructurado.
- Campos sugeridos:
  - `home_airport`
  - `traveler_defaults`
  - `budget_band`
  - `hotel_tier`
  - `pace`
  - `interests`
  - `special_constraints`
  - `recent_destinations`
  - `last_confirmed_dates`

### Retrieval de memoria

- En cada request, recuperar solo lo estrictamente util:
  - memoria estructurada del lead,
  - ultimo resumen de conversacion,
  - hasta `3` snippets relevantes de memoria larga no estructurada.

### Regla operativa

- Ningun request deberia depender de mandar toda la conversacion cruda.

## Tokens y Presupuesto de Contexto

## Objetivo de presupuesto por request

### Parser

- Objetivo: `1k-2k` tokens efectivos.
- No mandar historial bruto de `20` mensajes salvo casos excepcionales.
- Cambiar a:
  - ultimo resumen,
  - ultimo mensaje del usuario,
  - contexto estructurado relevante.

### Itinerario full

- Objetivo: `2k-6k` tokens de brief util.
- Incluir:
  - destinos,
  - fechas,
  - viajeros,
  - presupuesto,
  - intereses,
  - restricciones,
  - preferencias persistentes,
  - estado actual si hay edicion.
- No incluir:
  - conversacion historica completa,
  - texto duplicado,
  - ruido del chat.

### Retrieval de memoria

- Maximo sugerido: `800` tokens recuperados por request.

## Precios y Contexto Relevantes

Los valores siguientes son snapshot del analisis al `2026-04-25` y pueden cambiar.

### OpenAI

- `gpt-5-mini`
  - contexto: `400k`
  - precio: `$0.25` input / `$2.00` output por `1M` tokens
- `gpt-5-nano`
  - contexto: `400k`
  - precio: `$0.05` input / `$0.40` output por `1M` tokens
- `gpt-4.1`
  - contexto: `1M`
  - precio: `$2.00` input / `$8.00` output por `1M` tokens
- `text-embedding-3-small`
  - precio: `$0.02` por `1M` tokens

### Google Gemini

- `Gemini 2.5 Flash-Lite`
  - contexto: `1M`
  - precio aproximado oficial de referencia: `$0.10` input / `$0.40` output por `1M` tokens
- `Gemini 2.5 Flash`
  - contexto: `1M`
  - costo intermedio, util para workloads rapidos con mucho contexto
- `Gemini 2.5 Pro`
  - contexto: `1M`
  - mayor costo que Flash-Lite, orientado a razonamiento mas fuerte

### Anthropic

- `Claude Sonnet 4.6`
  - contexto: `1M`
  - precio: `$3.00` input / `$15.00` output por `1M` tokens

## Impacto Esperado

- Parser:
  - bajar costo unitario,
  - mantener o mejorar consistencia estructurada,
  - reducir dependencia del historial bruto.
- Repair pass:
  - ahorro muy alto al moverlo de `gpt-4.1` a `gpt-5-nano`.
- Itinerarios:
  - mantener `gpt-4.1` en `full|segment` preserva calidad donde el usuario la percibe.
  - mover `skeleton` a `gpt-5-mini` reduce costo sin dañar la capa editorial final.
- Negocio:
  - el costo principal queda concentrado en los itinerarios que realmente convierten,
  - no en parsing, memoria o reparaciones tecnicas.

## Cambios de Implementacion Recomendados

### 1. Crear una politica central de modelos

- Implementar una `model_policy` para rutear segun tarea:
  - `parser`
  - `itinerary_skeleton`
  - `itinerary_full`
  - `itinerary_segment`
  - `repair`
  - `summary`
  - `embeddings`

### 2. Medir siempre costo y uso

- Registrar por request:
  - `model`
  - `prompt_tokens`
  - `completion_tokens`
  - `cached_tokens` si aplica
  - `estimated_cost_usd`
  - `flow_name`
  - `conversation_id`
  - `lead_id`

### 3. Reducir contexto en parser

- Reemplazar envio de historial largo por:
  - resumen rodante,
  - contexto estructurado,
  - ultimo bloque relevante.

### 4. Separar memoria estructurada y memoria vectorial

- Estructurada:
  - preferencias y facts persistentes del lead.
- Vectorial:
  - notas largas,
  - PDFs,
  - observaciones libres.

### 5. Remover dependencias legacy externas de chat

- El chat debe pasar por `ai-message-parser` y `travel-itinerary`.
- No debe existir una edge function alternativa que delegue el chat a webhooks externos.
- Cualquier flujo legacy de chat fuera de la politica central de modelos debe eliminarse, no auditarse como proveedor paralelo.

### 6. Usar Batch solo para offline

- Casos recomendados:
  - resumir historiales viejos,
  - recalcular embeddings,
  - enriquecer PDFs o notas CRM.

## Plan de Validacion

### Set de prueba

- Armar un set de `200` conversaciones reales con:
  - parser puro,
  - follow-ups,
  - cambios de fecha,
  - cambios de presupuesto,
  - itinerarios nuevos,
  - ediciones sobre itinerarios existentes.

### Criterios de aceptacion para parser

- JSON valido en mas de `99.5%`.
- Error de routing o extraccion critica no peor que el baseline actual.
- Costo por turno de parsing al menos `35%` menor.

### Criterios de aceptacion para itinerario

- Misma o mejor tasa de aceptacion humana.
- Misma o menor tasa de `regenerate_day` o `regenerate_segment`.
- Igual o mejor score editorial en revision manual ciega de `50` casos.

### Criterios de aceptacion para memoria

- El sistema recuerda:
  - presupuesto,
  - viajeros,
  - origen,
  - preferencias del lead,
  sin reenviar todo el chat.
- Ningun request usa mas de `3` fuentes de memoria simultaneas.

### Telemetria minima

- costo por conversacion
- costo por lead
- costo por itinerario generado
- `p95` de latencia por endpoint
- ratio de `repair`
- ratio de contexto recuperado vs contexto enviado

## Riesgos y Tradeoffs

### Riesgo si solo se cambia de modelo

- Si no se toca la estrategia de contexto, el ahorro sera limitado.
- Seguir enviando mucho historial hace que incluso un modelo barato termine costando de mas.

### Riesgo de stack hibrido demasiado temprano

- Mas complejidad operativa.
- Mas testing.
- Mayor probabilidad de diferencias de comportamiento en JSON y estilo.

### Riesgo de abaratar demasiado el itinerario final

- Perdes calidad justo en la parte mas visible del producto.
- Eso impacta conversion y percepcion de valor, aunque el costo tecnico baje.

## Conclusiones Ejecutivas

- No te conviene optimizar primero por proveedor; te conviene optimizar primero por arquitectura de contexto.
- Para este negocio, la mejor configuracion actual es:
  - `OpenAI` como proveedor principal,
  - `gpt-5-mini` para parsing y `skeleton`,
  - `gpt-4.1` para itinerarios `full|segment`,
  - `gpt-5-nano` para `repair` y resumentes,
  - memoria por `lead/client` y no por historial bruto,
  - embeddings solo para texto no estructurado.
- Si el volumen supera fuerte el rango actual, el siguiente paso natural seria evaluar un esquema hibrido con `Gemini` para tareas de bajo riesgo y alto volumen.

## Fuentes Oficiales

- OpenAI pricing:
  - <https://platform.openai.com/docs/pricing/>
- OpenAI `gpt-4.1`:
  - <https://platform.openai.com/docs/models/gpt-4.1>
- OpenAI `gpt-5-mini`:
  - <https://platform.openai.com/docs/models/gpt-5-mini>
- Anthropic pricing:
  - <https://platform.claude.com/docs/en/docs/about-claude/pricing>
- Anthropic models overview:
  - <https://platform.claude.com/docs/claude/docs/models-overview>
- Gemini pricing:
  - <https://ai.google.dev/gemini-api/docs/pricing>
- Gemini `2.5 Flash`:
  - <https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash>
- Gemini `2.5 Flash-Lite`:
  - <https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite>
- Gemini `2.5 Pro`:
  - <https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro>

## Contexto del Repo Considerado en el Analisis

- `ai-message-parser` usa hoy `gpt-4.1-mini` y manda historial de conversacion largo.
- `travel-itinerary` usa hoy `gpt-4.1` para generacion y reparacion.
- `travel-itinerary` ya soporta `generationMode=skeleton|segment|full`.
- `messageStorageService` ya persiste memoria de conversacion y `context_state`, por lo que hay base real para evolucionar hacia memoria por lead y resumen estructurado.
- No debe haber dependencia activa de webhooks externos para el chat.
