# Manual de Usuario - Búsquedas de Viajes con IA

## Introducción

WholeSale Connect AI es un asistente inteligente que te ayuda a buscar vuelos y paquetes combinados para tus clientes. Este manual te enseñará cómo comunicarte efectivamente con la IA para obtener los mejores resultados basándose en las funcionalidades **actualmente implementadas y funcionando**.

---

## ✈️ Búsqueda de Vuelos

### Información Necesaria

Para buscar vuelos, la IA necesita:
- **Origen**: Ciudad de salida (código IATA o nombre)
- **Destino**: Ciudad de llegada
- **Fecha de ida**: Cuándo viajas
- **Fecha de vuelta**: Si es ida y vuelta (opcional para solo ida)
- **Pasajeros**: Adultos y niños (por defecto asume 1 adulto si no especificas)

### Ejemplos de Prompts Correctos

#### ✅ Ejemplo 1: Vuelo Ida y Vuelta Básico
```
Usuario: "Vuelos de Madrid a Nueva York del 1 al 8 de junio"
```

**Respuesta esperada de la IA:**
```
🔍 Analizando tu solicitud de vuelos...

✈️ Buscando vuelos: MAD → JFK
📅 Salida: 2026-06-01
📅 Regreso: 2026-06-08
👥 1 adulto

[La IA mostrará tarjetas con opciones de vuelo incluyendo:]
- Aerolínea
- Horarios de salida y llegada
- Duración total del vuelo
- Cantidad de escalas
- Precio por pasajero
- Tipo de equipaje incluido
```

#### ✅ Ejemplo 2: Vuelo con Múltiples Pasajeros
```
Usuario: "Necesito vuelos de Buenos Aires a Madrid del 15 de marzo para 2 adultos y 1 niño"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos: EZE → MAD
📅 Salida: 2026-03-15
👥 2 adultos, 1 niño

[Opciones de vuelo para 3 pasajeros total]
```

#### ✅ Ejemplo 3: Solo Ida
```
Usuario: "Vuelo solo ida de Barcelona a Londres el 20 de noviembre"
```

**Respuesta esperada:**
```
✈️ Vuelo solo ida: BCN → LHR
📅 Salida: 2025-11-20
👥 1 adulto

[Opciones de vuelo solo ida]
```

#### ✅ Ejemplo 4: Con Preferencia de Escalas
```
Usuario: "Vuelos de México a París del 10 al 20 de diciembre, acepto una escala"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos con máximo 1 escala
📍 MEX → CDG
📅 10/12 - 20/12
👥 1 adulto

[Vuelos filtrados con 0 o 1 escala solamente]
```

#### ✅ Ejemplo 5: Vuelos Directos
```
Usuario: "Necesito vuelos directos de Miami a Cancún del 5 al 12 de febrero"
```

**Respuesta esperada:**
```
✈️ Buscando solo vuelos DIRECTOS
📍 MIA → CUN
📅 05/02 - 12/02
👥 1 adulto

[Solo opciones de vuelo sin escalas]
```

#### ✅ Ejemplo 6: Con Límite de Tiempo en Escalas
```
Usuario: "Vuelos de Madrid a Tokyo del 1 al 15 de agosto con escalas de no más de 5 horas"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos con escalas ≤ 5 horas
📍 MAD → TYO
📅 01/08 - 15/08
👥 1 adulto

[El sistema hace búsqueda expandida y filtra por duración de escala]
```

### Formatos de Fecha Aceptados

La IA entiende múltiples formatos de fecha:

**✅ Fechas relativas:**
- "en marzo" → Primera semana de marzo del año que corresponda
- "primera semana de julio" → Julio 1-7
- "próximo mes" → Mes siguiente

**✅ Fechas específicas:**
- "15 de diciembre" → 15/12/[año inteligente]
- "del 15 al 20 de diciembre" → Check-in: 15/12, Check-out: 20/12
- "15/12/2025" → Formato numérico
- "2025-12-15" → Formato ISO

**🧠 Lógica Inteligente de Años:**
La IA usa el año correcto automáticamente:
- Si el mes **YA PASÓ** este año → usa el **año siguiente**
- Si el mes **AÚN NO llega** este año → usa el **año actual**

Ejemplo (asumiendo hoy es 5 de octubre de 2025):
- "en marzo" → Marzo 2026 (porque marzo 2025 ya pasó)
- "en noviembre" → Noviembre 2025 (aún no ha llegado este año)

### Preferencias de Vuelo que la IA Entiende

#### Escalas (Stops):
La IA reconoce estas preferencias:

- **"directo", "sin escalas", "non-stop"** → Solo vuelos directos
- **"con una escala", "1 escala"** → Máximo 1 parada
- **"con dos escalas"** → Máximo 2 paradas
- **"con escalas"** → Cualquier cantidad de escalas (genérico)
- **Sin mencionar escalas** → Muestra todas las opciones (directos y con escalas)

#### Duración de Escalas:
Si especificas tiempo máximo de escala:
```
"con escalas de no más de 3 horas"
"escalas cortas de máximo 4 horas"
```

La IA:
1. Hace una búsqueda amplia
2. Calcula el tiempo real de cada escala
3. Filtra solo las opciones que cumplan el criterio

#### Equipaje (Opcional):
**⚠️ IMPORTANTE:** Solo menciona equipaje si tienes una preferencia específica

- **"con equipaje en bodega", "con valija", "equipaje facturado"** → Busca opciones con equipaje despachado
- **"solo equipaje de mano", "carry on"** → Solo equipaje de cabina
- **No mencionar equipaje** → La IA NO filtrará por equipaje

#### Aerolínea Preferida (Opcional):
**⚠️ IMPORTANTE:** Solo menciona aerolínea si tienes preferencia

```
"vuelos con Iberia"
"prefiero American Airlines"
"en Aeromexico"
```

Si NO mencionas aerolínea, la IA buscará en todas las disponibles.

### Códigos IATA de Aeropuertos Comunes

| Ciudad | Código IATA | Notas |
|--------|-------------|-------|
| Madrid | MAD | Aeropuerto Adolfo Suárez Madrid-Barajas |
| Barcelona | BCN | El Prat |
| Nueva York | JFK | John F. Kennedy (también: EWR, LGA) |
| Los Angeles | LAX | Principal de LA |
| Miami | MIA | Miami International |
| Cancún | CUN | Principal destino turístico México |
| Buenos Aires | EZE | Ezeiza (internacional), AEP (doméstico) |
| Ciudad de México | MEX | AICM |
| Lima | LIM | Jorge Chávez |
| Bogotá | BOG | El Dorado |
| París | CDG | Charles de Gaulle (también: ORY) |
| Londres | LHR | Heathrow (también: LGW, STN) |
| Tokyo | NRT | Narita (también: HND Haneda) |

**💡 No es obligatorio usar códigos:** La IA entiende nombres de ciudades y los convierte automáticamente.

### Cómo Iterar la Búsqueda de Vuelos

Una vez que recibas resultados, puedes refinar:

```
✅ "Muéstrame solo vuelos directos"

✅ "Busca opciones más baratas"

✅ "Con una escala máximo"

✅ "Dame vuelos con salida por la mañana"

✅ "Ordena por precio de menor a mayor"

✅ "¿Hay vuelos en otras fechas más económicas?"
```

**⚠️ LIMITACIÓN ACTUAL:** La iteración con contexto previo puede no funcionar perfectamente. Si la IA "olvida" tu búsqueda anterior, repite la solicitud completa con los cambios.

---

## 🏝️ Búsqueda de Paquetes (Vuelo + Hotel)

### Información Necesaria

Para paquetes combinados:
- **Origen del vuelo**: Ciudad de salida
- **Destino**: Ciudad/resort
- **Fechas**: Fecha de ida y vuelta (el sistema calcula check-in/check-out automáticamente)
- **Pasajeros**: Adultos y niños (por defecto 1 adulto)

### Ejemplos de Prompts Correctos

#### ✅ Ejemplo 1: Paquete Completo Básico
```
Usuario: "Busca paquete de vuelo y hotel desde Madrid a Cancún del 20 al 27 de diciembre"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada: Vuelos + Hoteles

✈️ VUELOS
📍 MAD → CUN
📅 20/12 - 27/12
[Opciones de vuelo]

🏨 HOTELES
📍 Cancún
📅 Check-in: 20/12 | Check-out: 27/12
🌙 7 noches
[Opciones de hotel]
```

#### ✅ Ejemplo 2: Paquete para Familia
```
Usuario: "Paquete familiar a Punta Cana desde Barcelona del 5 al 15 de febrero, 2 adultos 2 niños"
```

**Respuesta esperada:**
```
🌟 Paquete familiar

✈️ VUELOS: BCN → PUJ
👥 2 adultos, 2 niños
📅 05/02 - 15/02

🏨 HOTELES en Punta Cana
🛏️ Habitaciones para 4 personas
🌙 10 noches
```

#### ✅ Ejemplo 3: Con Preferencias de Vuelo
```
Usuario: "Paquete a Miami desde Ciudad de México del 10 al 17 de marzo, vuelos directos"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada

✈️ VUELOS DIRECTOS
MEX → MIA (10-17 marzo)

🏨 HOTELES en Miami
7 noches
```

### Funcionamiento Técnico de Búsqueda Combinada

**🔧 Cómo funciona internamente:**

1. **Búsquedas Paralelas:** El sistema ejecuta la búsqueda de vuelos y hoteles simultáneamente (no secuencial)
2. **Enriquecimiento Automático:** Si faltan datos de hotel (fechas, pasajeros), los toma de los datos de vuelo
3. **Resultados Independientes:** Muestra vuelos y hoteles por separado, tú eliges la combinación que prefieras

**⚠️ IMPORTANTE:**
- No se reservan juntos automáticamente
- Cada vuelo y hotel se cotiza independientemente
- Puedes combinar cualquier vuelo con cualquier hotel de los resultados

---

## 💡 Consejos para Mejores Resultados

### ✅ Buenas Prácticas

1. **Sé específico con las fechas**
   - ❌ "En verano"
   - ✅ "Del 15 de julio al 22 de julio"

2. **Indica ida y vuelta claramente**
   - ❌ "Vuelo a Londres el 10 de mayo"
   - ✅ "Vuelo ida y vuelta a Londres del 10 al 17 de mayo"
   - ✅ "Vuelo solo ida a Londres el 10 de mayo"

3. **No necesitas especificar pasajeros si viajas solo**
   - Por defecto asume 1 adulto
   - Solo menciona si son 2 o más personas

4. **Preferencias opcionales solo si son importantes**
   - NO menciones aerolínea si no tienes preferencia
   - NO menciones equipaje si no es crítico
   - Solo agrega restricciones si realmente las necesitas

5. **Usa lenguaje natural**
   - No necesitas hablar formal
   - La IA entiende conversaciones normales

### ❌ Errores Comunes a Evitar

1. **No proporcionar fechas**
   ```
   ❌ "Busca vuelos a Cancún"
   ✅ "Busca vuelos a Cancún del 15 al 20 de diciembre"
   ```

2. **Ambigüedad en ida/vuelta**
   ```
   ❌ "Vuelo a París el 1 de junio"
   ✅ "Vuelo ida y vuelta a París del 1 al 8 de junio"
   ✅ "Vuelo solo ida a París el 1 de junio"
   ```

3. **Mezclar múltiples búsquedas**
   ```
   ❌ "Busca vuelos a Cancún y a Miami y también a Punta Cana"
   ✅ [Hacer una búsqueda a la vez]
   ```

4. **Agregar restricciones innecesarias**
   ```
   ❌ "Vuelo directo con Iberia con equipaje facturado solo ventana asiento 12A"
   ✅ "Vuelo directo de Madrid a Nueva York del 1 al 8 de junio"
   ```

---

## 🔄 Conversaciones de Ejemplo (Reales)

### Ejemplo 1: Búsqueda de Vuelos Simple

```
Usuario: "Vuelos de Madrid a Nueva York del 1 al 8 de junio"

IA: "🔍 Analizando tu solicitud de vuelos...

     ✈️ Buscando vuelos: MAD → JFK
     📅 Salida: 2026-06-01
     📅 Regreso: 2026-06-08
     👥 1 adulto

     [Mostrando opciones de vuelo con precios, horarios, escalas]"
```

### Ejemplo 2: Búsqueda con Preferencias

```
Usuario: "Vuelos directos de Barcelona a Roma del 5 al 10 de mayo para 2 personas"

IA: "✈️ Buscando solo vuelos DIRECTOS

     BCN → FCO
     📅 05/05/2026 - 10/05/2026
     👥 2 adultos

     [Opciones de vuelo directo para 2 pasajeros]"

Usuario: "¿Y si acepto una escala?"

IA: [Problema potencial: puede que no recuerde el contexto]

     Solución: "Vuelos BCN-Roma del 5 al 10 de mayo para 2 personas con una escala"
```

### Ejemplo 3: Paquete Completo

```
Usuario: "Paquete vuelo y hotel de Madrid a Cancún del 20 al 27 de diciembre"

IA: "🌟 Búsqueda combinada: Vuelos + Hoteles

     ✈️ VUELOS
     MAD → CUN
     20-27 diciembre 2025
     1 adulto

     [Opciones de vuelo]

     🏨 HOTELES
     Cancún
     Check-in: 20/12 | Check-out: 27/12
     7 noches
     1 adulto

     [Opciones de hotel ordenados por precio]"
```

### Ejemplo 4: Solicitud Incompleta

```
Usuario: "Quiero viajar"

IA: "Para buscar tu vuelo necesito:

     **Origen:** ¿Desde dónde viajas?
     **Destino:** ¿A dónde quieres ir?
     **Fecha:** ¿Cuándo viajas?"

Usuario: "A París en junio"

IA: "Para buscar tu vuelo necesito:

     **Origen:** ¿Desde dónde viajas?
     **Fecha:** ¿Qué días de junio exactamente?"
```

---

## 🎯 Funcionalidades Implementadas vs. No Implementadas

### ✅ Funciona Actualmente (100% Real)

1. **Búsqueda de Vuelos**
   - Origen → Destino con fechas
   - Ida y vuelta / Solo ida
   - Múltiples pasajeros (adultos + niños)
   - Filtro por escalas (directo, 1 escala, 2 escalas, cualquiera)
   - Filtro por duración máxima de escala
   - Preferencia de aerolínea (opcional)
   - Conversión automática de ciudades a códigos IATA
   - Detección inteligente de año (usa año correcto según fecha actual)

2. **Búsqueda de Paquetes (Vuelo + Hotel)**
   - Búsquedas paralelas de vuelos y hoteles
   - Enriquecimiento automático de datos
   - Resultados combinados

3. **Inteligencia de la IA (ai-message-parser)**
   - Análisis de lenguaje natural en español
   - Tolerancia a errores de tipeo
   - Detección de intenciones de viaje
   - Valores por defecto inteligentes
   - Solicitud de información faltante
   - Memoria de contexto previo (limitada)

### ❌ NO Implementado Actualmente

1. **Guardado de búsquedas** - No puedes guardar para más tarde
2. **Alertas de precio** - No hay sistema de notificaciones
3. **Comparación lado a lado** - No hay tabla comparativa automática
4. **Flexibilidad de fechas con matriz** - No muestra precios en +/- días
5. **Filtros dinámicos en tiempo real** - Los filtros son parte de la búsqueda inicial
6. **Generación automática de PDF** - Existe código pero no verificado en flujo completo
7. **Iteración perfecta con contexto** - La memoria entre mensajes puede fallar
8. **Comandos rápidos** - No hay comandos especiales tipo "/buscar"

### 🚧 Funciona Parcialmente

1. **Búsqueda de Hoteles Individuales** - Código existe pero no se probó (solo en paquetes)
2. **Iteración de búsquedas** - Funciona a veces, otras veces pierde el contexto
3. **Historial de conversación** - Se guarda pero uso limitado

---

## 🧪 Casos de Prueba Verificados

Estos prompts fueron probados con CURL y funcionan:

### ✅ Test 1: Hotel Básico
```
Input: "Busca hoteles en Cancún del 15 al 20 de diciembre"
Output: ✅ Parsea correctamente
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "2025-12-15",
    "checkoutDate": "2025-12-20",
    "adults": 1,
    "children": 0
  }
}
```

### ✅ Test 2: Vuelo con Fechas y Destinos
```
Input: "Vuelos de Madrid a Nueva York del 1 al 8 de junio"
Output: ✅ Parsea correctamente
{
  "requestType": "flights",
  "flights": {
    "origin": "MAD",
    "destination": "JFK",
    "departureDate": "2026-06-01",
    "returnDate": "2026-06-08",
    "adults": 1,
    "children": 0,
    "stops": "any"
  }
}
```

### ❌ Test 3: Iteración con Contexto
```
Input: "Muéstrame opciones más económicas"
Context: {vuelo MAD-JFK del 1-8 junio}
Output: ❌ NO funciona correctamente
- Pierde el contexto anterior
- Pide origen/destino/fecha de nuevo
```

**Conclusión:** La iteración con contexto previo no es confiable actualmente.

---

## 📱 Sistema Técnico Real

### Flujo de Procesamiento

1. **Usuario envía mensaje** → Frontend (React)
2. **Frontend llama** → `ai-message-parser` (Supabase Edge Function)
3. **AI Parser usa** → OpenAI GPT-4o-mini para entender el mensaje
4. **Parser retorna** → JSON estructurado con intención y parámetros
5. **Frontend llama** → Funciones de búsqueda (`handleFlightSearch`, etc.)
6. **Búsquedas llaman** → APIs externas:
   - **Vuelos:** `starling-flights` → TVC API
   - **Hoteles:** `eurovips-soap` → EUROVIPS API
7. **Resultados se transforman** → Formato estandarizado
8. **Frontend muestra** → Tarjetas de resultados al usuario

### Proveedores de Datos

- **Vuelos:** TVC (The Vacation Channel) via Starling API
- **Hoteles:** EUROVIPS WebService (LOZADA)
- **Paquetes:** Combinación de ambos

---

## ❓ Preguntas Frecuentes (Verificadas)

### ¿Los precios son finales?
Los precios mostrados son **referenciales y sujetos a disponibilidad**. Siempre confirma antes de reservar.

### ¿Puedo buscar para grupos grandes?
Sí, especifica el número exacto de pasajeros. El sistema soporta múltiples adultos y niños.

### ¿La IA entiende abreviaciones?
Sí, códigos IATA (JFK, MAD, CUN) y nombres de ciudades completos.

### ¿Funciona la memoria entre mensajes?
**Parcialmente**. La IA intenta recordar el contexto pero puede fallar. Si olvida tu búsqueda, repite la solicitud completa.

### ¿Puedo cambiar la moneda?
Los precios se muestran en la moneda del proveedor (usualmente USD o EUR según el servicio).

### ¿Cómo se calculan las escalas?
El sistema:
1. Obtiene todos los segmentos del vuelo
2. Calcula tiempo entre llegada de un segmento y salida del siguiente
3. Filtra según tu límite de tiempo especificado

---

## 🆘 Soporte y Limitaciones

### Si algo no funciona:

1. **Reformula tu pregunta** con información más específica
2. **Incluye todas las fechas** en formato claro (dd/mm o "del X al Y de [mes]")
3. **Especifica ida y vuelta** o "solo ida" explícitamente
4. **Repite la búsqueda completa** si la IA pierde el contexto

### Limitaciones Conocidas:

- ✋ **Iteración imperfecta:** Puede olvidar contexto entre mensajes
- ✋ **Sin guardar búsquedas:** No hay función de favoritos
- ✋ **Sin alertas:** No notifica cambios de precio
- ✋ **Solo español:** El parser está optimizado para español

---

## 📋 Resumen de Mejores Prácticas

### ✅ HACER:
- Incluir origen, destino y fechas siempre
- Especificar "ida y vuelta" o "solo ida"
- Usar lenguaje natural claro
- Mencionar pasajeros solo si son 2 o más
- Agregar preferencias solo si son importantes
- Dar fechas exactas o rangos claros

### ❌ EVITAR:
- Búsquedas sin fechas completas
- Asumir que la IA recuerda búsquedas anteriores
- Mezclar múltiples destinos en un mensaje
- Agregar demasiadas restricciones innecesarias
- Usar jerga excesivamente técnica

---

## 🔧 Para Desarrolladores

**Funciones Supabase Edge:**
- `ai-message-parser` - Procesa lenguaje natural → JSON estructurado
- `starling-flights` - Búsqueda de vuelos en TVC API
- `eurovips-soap` - Búsqueda de hoteles/paquetes en EUROVIPS
- `search-coordinator` - Coordina búsquedas paralelas (no usado actualmente)

**Servicios Frontend:**
- `searchHandlers.ts` - Maneja lógica de búsquedas
- `messageService.ts` - Coordina mensajes y llamadas a IA
- `aiMessageParser.ts` - Cliente para ai-message-parser

---

**Versión:** 2.0 (Verificada y Basada en Código Real)
**Última actualización:** 5 Octubre 2025
**Sistema:** WholeSale Connect AI
**Estado:** ✅ Funcionalidades verificadas con código y pruebas CURL
