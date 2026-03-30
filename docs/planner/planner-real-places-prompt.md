# Planner Prompt: Lugares Reales, Fotos y Descripciones

## Objetivo
Hacer que el planner devuelva sugerencias mas utiles para:

- `recommendedPlaces` del chat
- actividades del itinerario
- lugares que se abren al hacer click en el mapa

La idea es empujar al modelo a devolver lugares reales, especificos, visualmente utiles y faciles de resolver en servicios de lugares/mapas.

Importante: en este repo, `recommendedPlaces` se extrae desde las actividades generadas por `travel-itinerary`. O sea: si las actividades pasan a ser lugares reales con `description`, el chat mejora automaticamente.

## Donde pegarlo

### Primario
Archivo: `supabase/functions/travel-itinerary/index.ts`

Aplicar en:

1. `buildDetailedPlannerPrompt`
2. `buildSegmentEnrichmentPrompt`

### Opcional pero recomendado
Archivo: `supabase/functions/planner-agent/prompts/system.ts`

Agregar un refuerzo corto para que el agente tambien pida resultados mas reales cuando interactua con el planner.

---

## 1. `buildDetailedPlannerPrompt`

### 1A. Reemplazar el bloque que va desde `OUTPUT LIMITS:` hasta antes de `REQUEST_CONTEXT:`

Pegar este bloque:

```txt
OUTPUT LIMITS:
- title: short.
- title should feel specific to the actual destination(s) or route, not just to a mood.
- summary: max 22 words.
- generalTips: 0 to 3 items total.
- segment summary: max 18 words.
- day title: max 8 words.
- day summary: max 16 words.
- morning, afternoon, evening: 0 to 1 activity each.
- Activity objects should usually include "title", "category" and a short "description".
- Activity descriptions should be 10 to 22 words, concrete, visual, and useful.
- Omit times unless absolutely necessary; the server adds times.
- restaurants: 0 to 1 item per day.
- travelTip: optional, max 12 words.
- No prices, ticket costs, exact opening hours, or stale details.

REAL PLACE REQUIREMENTS:
- Every activity, restaurant, cafe, museum, park, viewpoint, market, bar, or landmark must be a real place.
- Never invent places, venues, attractions, or restaurant names.
- Never use vague placeholders like "walking tour", "local dinner", "historic center stroll", "tapas in a traditional district", "museum circuit", or "sunset in a nice spot" unless they refer to a real named place.
- Prefer specific POIs with exact names that are easy to recognize in maps and places APIs.
- Prefer places that are well known, highly reviewed, or visually distinctive enough to likely have public photos.
- If a place name is ambiguous, use the most recognizable official or commonly used version.
- If you are not confident a place is real, replace it with a more recognizable real place.
- Fewer real places are better than many generic or invented suggestions.

MAP AND PHOTO FRIENDLY OUTPUT:
- Choose places that are likely resolvable by exact name plus city.
- Prefer attractions, restaurants, cafes, museums, parks, and landmarks with strong visual identity.
- Descriptions should help the UI show a useful card or map detail panel.
- Descriptions must explain why the place is interesting, not just repeat the title.

RESTAURANTS AND CAFES:
- Restaurants and cafes must use their real commercial names.
- Prefer iconic, popular, or consistently reviewed places.
- Do not output generic entries like "traditional dinner", "local cafe", or "restaurant in the old town".

QUALITY BAR:
- Good: "Museo del Prado", "Parque del Retiro", "Villa Borghese", "Basílica de San Pedro", "Casa Dani"
- Bad: "Cultural walk in Madrid", "Tapas in La Latina", "Dinner in a local neighborhood", "Visit to famous museums"
```

### 1B. Reemplazar el `OUTPUT_TEMPLATE` del prompt detallado por este

```txt
OUTPUT_TEMPLATE:
{
  "title": "Trip title",
  "summary": "Short overview",
  "generalTips": ["tip 1", "tip 2"],
  "segments": [
    {
      "city": "Madrid",
      "country": "Spain",
      "summary": "Short segment summary",
      "days": [
        {
          "title": "Prado y Retiro",
          "summary": "Arte y paseo clasico",
          "morning": [
            {
              "title": "Museo del Prado",
              "category": "Museo",
              "description": "Pinacoteca iconica con obras maestras de Velazquez, Goya y Rubens."
            }
          ],
          "afternoon": [
            {
              "title": "Parque del Retiro",
              "category": "Parque",
              "description": "Gran pulmon verde ideal para caminar, remar y descansar entre jardines historicos."
            }
          ],
          "evening": [
            {
              "title": "Casa Dani",
              "category": "Gastronomia",
              "description": "Bar muy popular por su tortilla espanola y ambiente madrileno clasico."
            }
          ],
          "restaurants": [{ "name": "Casa Dani", "type": "Tapas", "priceRange": "$$" }],
          "travelTip": "Conviene moverse en metro."
        }
      ]
    }
  ]
}
```

---

## 2. `buildSegmentEnrichmentPrompt`

### 2A. Reemplazar el bloque `MUST FOLLOW:` por este

```txt
MUST FOLLOW:
- Respect the traveler profile "${travelerProfile}": ${profileGuidelines}
- Morning, afternoon, evening: 0 to 1 activity each.
- Restaurants: 0 to 1 item per day.
- travelTip: optional, max 12 words.
- No prices, opening hours, or stale details.
- All activities and restaurant suggestions must be real named places.
- Prefer exact POIs that are easy to resolve on maps by name plus city.
- Avoid generic placeholders like "local walk", "traditional dinner", "historic district stroll", or "museum area".
- Activity objects should usually include "title", "category" and a short "description".
- Activity descriptions should be concrete, visual, and useful for cards and map detail views.
- Restaurants and cafes must use real commercial names.
- If unsure whether a place is real, replace it with a more famous and verifiable one.
```

### 2B. Reemplazar el `OUTPUT_TEMPLATE` del enrichment por este

```txt
OUTPUT_TEMPLATE:
{
  "segments": [
    {
      "city": "Madrid",
      "country": "Spain",
      "summary": "Short segment summary",
      "days": [
        {
          "title": "Prado y Retiro",
          "summary": "Arte y paseo clasico",
          "morning": [
            {
              "title": "Museo del Prado",
              "category": "Museo",
              "description": "Pinacoteca iconica con obras maestras de Velazquez, Goya y Rubens."
            }
          ],
          "afternoon": [
            {
              "title": "Parque del Retiro",
              "category": "Parque",
              "description": "Gran pulmon verde ideal para caminar, remar y descansar entre jardines historicos."
            }
          ],
          "evening": [
            {
              "title": "Casa Dani",
              "category": "Gastronomia",
              "description": "Bar muy popular por su tortilla espanola y ambiente madrileno clasico."
            }
          ],
          "restaurants": [{ "name": "Casa Dani", "type": "Tapas", "priceRange": "$$" }],
          "travelTip": "Conviene moverse en metro."
        }
      ]
    }
  ]
}
```

---

## 3. Refuerzo opcional en `planner-agent/prompts/system.ts`

Esto no reemplaza el bloque anterior. Solo refuerza el comportamiento del agente para que la intencion ya llegue mas clara al generador.

Agregar este bloque dentro del prompt, por ejemplo despues de `## FORMATO DE RESPUESTA` o antes:

```txt
## LUGARES REALES EN SUGERENCIAS

- Cuando sugieras actividades, restaurantes, cafes, museos o lugares para agregar al planner, prioriza siempre lugares reales y especificos.
- No sugieras lugares genericos o inventados.
- Usa nombres exactos y reconocibles, faciles de resolver en mapa.
- Si recomiendas un lugar, prioriza opciones con buena presencia visual y alta probabilidad de tener fotos publicas.
- Evita textos vagos como "paseo por la zona", "cena en barrio local", "actividad cultural", salvo que refieran a un lugar con nombre concreto.
- Si no tienes alta confianza en que un lugar exista realmente, usa uno mas conocido y verificable.
```

---

## 4. Resultado esperado

Con estos cambios deberia mejorar:

- Lo que aparece en `recommendedPlaces`
- Las cards de "Que hacer en ..."
- El detalle del lugar al hacer click en mapa
- La probabilidad de que haya foto real para el lugar
- La calidad semantica de `activity.description`

---

## 5. Nota importante sobre fotos

El prompt puede empujar a elegir lugares con alta probabilidad de tener fotos, pero no garantiza fotos por si solo.

Para que siempre haya foto real cuando exista, la otra mitad del problema sigue siendo tecnica:

- resolver bien el lugar por nombre + ciudad
- traer `photoUrls` desde Foursquare / Places
- preferir POIs reales antes que texto generico

Este prompt mejora justo esa parte: hace que el nombre del lugar sea mucho mas resoluble.
